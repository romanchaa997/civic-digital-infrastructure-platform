import asyncio
import time
import logging
from typing import Dict, Any, Callable, List, Optional
from dataclasses import dataclass

from job_context import JobContext, AgentStatus

logger = logging.getLogger(__name__)

@dataclass
class AgentTask:
    """Definition of agent work"""
    name: str
    agent_func: Callable
    timeout_sec: int = 30
    max_retries: int = 2

class JobCoordinator:
    """
    Orchestrator for parallel agent execution.
    Manages global job context and coordinates 3 independent agents:
    - Collector: extracts & normalizes context
    - Drafter: generates code & patches
    - Validator: creates tests & validation rules
    """
    
    def __init__(self, job_context: JobContext):
        self.global_state = job_context
        self.agents: Dict[str, AgentTask] = {}
        self.metrics: Dict[str, Dict[str, Any]] = {}
    
    def register_agent(self, agent_task: AgentTask):
        """Register an agent for execution"""
        self.agents[agent_task.name] = agent_task
        self.metrics[agent_task.name] = {
            'attempts': 0,
            'total_latency_ms': 0,
            'max_latency_ms': 0
        }
    
    async def execute_parallel(self) -> Dict[str, Any]:
        """
        Execute all registered agents in parallel using asyncio.gather.
        Each agent receives role-filtered context from global_state.
        """
        logger.info(f"Starting parallel execution for job {self.global_state.job_id}")
        
        tasks = []
        agent_names = []
        
        for agent_name, agent_task in self.agents.items():
            agent_names.append(agent_name)
            # Get role-filtered context for this agent
            agent_context = self.global_state.get_agent_context(agent_name)
            
            # Wrap agent call with retry & timeout logic
            task = self._run_agent_with_resilience(
                agent_name,
                agent_task,
                agent_context
            )
            tasks.append(task)
        
        # Run all agents concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Merge results back into global state
        self._merge_results(agent_names, results)
        
        logger.info(f"Parallel execution completed. Job state: {self.global_state.to_dict()}")
        return self.global_state.to_dict()
    
    async def _run_agent_with_resilience(
        self,
        agent_name: str,
        agent_task: AgentTask,
        agent_context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Execute single agent with retry logic & timeout.
        """
        self.global_state.agent_state[agent_name].status = AgentStatus.ACTIVE
        
        for attempt in range(agent_task.max_retries):
            try:
                self.metrics[agent_name]['attempts'] += 1
                
                start_time = time.time()
                result = await asyncio.wait_for(
                    agent_task.agent_func(agent_context, self.global_state),
                    timeout=agent_task.timeout_sec
                )
                latency_ms = (time.time() - start_time) * 1000
                
                # Track metrics
                self.metrics[agent_name]['total_latency_ms'] += latency_ms
                self.metrics[agent_name]['max_latency_ms'] = max(
                    self.metrics[agent_name]['max_latency_ms'],
                    latency_ms
                )
                
                logger.info(f"{agent_name} completed in {latency_ms:.2f}ms")
                return {'agent': agent_name, 'result': result, 'error': None}
            
            except asyncio.TimeoutError:
                logger.error(f"{agent_name} timed out after {agent_task.timeout_sec}s (attempt {attempt+1})")
                if attempt == agent_task.max_retries - 1:
                    self.global_state.update_agent_state(
                        agent_name,
                        AgentStatus.TIMEOUT,
                        error=f"Timeout after {agent_task.timeout_sec}s"
                    )
                    return {'agent': agent_name, 'result': None, 'error': 'timeout'}
                await asyncio.sleep(0.5 * (2 ** attempt))  # exponential backoff
            
            except Exception as e:
                logger.error(f"{agent_name} failed: {str(e)} (attempt {attempt+1})")
                if attempt == agent_task.max_retries - 1:
                    self.global_state.update_agent_state(
                        agent_name,
                        AgentStatus.FAILED,
                        error=str(e)
                    )
                    return {'agent': agent_name, 'result': None, 'error': str(e)}
                await asyncio.sleep(0.5 * (2 ** attempt))
    
    def _merge_results(self, agent_names: List[str], results: List[Dict[str, Any]]):
        """
        Sync agent results back to global state (blackboard pattern).
        """
        for agent_name, result in zip(agent_names, results):
            if isinstance(result, Exception):
                logger.error(f"Agent {agent_name} raised: {result}")
                self.global_state.update_agent_state(agent_name, AgentStatus.FAILED, error=str(result))
            elif result.get('error'):
                logger.warning(f"Agent {agent_name} returned error: {result['error']}")
                self.global_state.update_agent_state(agent_name, AgentStatus.FAILED, error=result['error'])
            else:
                logger.info(f"Agent {agent_name} succeeded")
                self.global_state.update_agent_state(
                    agent_name,
                    AgentStatus.COMPLETED,
                    result=result.get('result')
                )
                # Merge artifacts if agent returned them
                if result.get('result') and 'artifacts' in result['result']:
                    self.global_state.artifacts.update(result['result']['artifacts'])
    
    def get_metrics(self) -> Dict[str, Any]:
        """Return aggregated metrics for all agents"""
        return {
            'agents': self.metrics,
            'global_state': self.global_state.to_dict()
        }
