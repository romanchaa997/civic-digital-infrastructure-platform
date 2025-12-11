"""Orchestration Runner for Civic Digital Infrastructure Platform

Integrates JobCoordinator with existing agent pipeline for parallel execution.
"""

import asyncio
import time
from typing import Dict, Any, Optional
from coordinator import JobCoordinator, JobContext, AgentStatus
from coordinator.metrics import global_metrics, AgentMetrics

class CivicOrchestrator:
    """Civic-specific orchestration wrapper"""
    
    def __init__(self):
        self.coordinator = None
        self.job_context = None
    
    async def run(self, job_spec: Dict[str, Any]) -> Dict[str, Any]:
        """Main entry point for orchestrated execution"""
        try:
            # 1. Initialize global context with spec
            self.job_context = JobContext(
                job_id=job_spec.get('id', 'civic-job'),
                task=job_spec.get('task', {}),
                constraints=job_spec.get('constraints', [])
            )
            
            # 2. Create coordinator
            self.coordinator = JobCoordinator(self.job_context)
            
            # 3. Register agents from spec
            agents_to_run = job_spec.get('agents', ['collector', 'drafter', 'validator'])
            for agent_name in agents_to_run:
                agent = self._get_agent(agent_name)
                if agent:
                    self.coordinator.register_agent(agent)
            
            # 4. Execute parallel (THIS IS asyncio.gather UNDER THE HOOD)
            result = await self.coordinator.execute_parallel()
            
            # 5. Record metrics
            for agent_name, metrics in self.coordinator.metrics.items():
                agent_metrics = AgentMetrics(
                    agent_name=agent_name,
                    start_time=time.time(),
                    status='completed',
                    input_size=0,
                    output_size=len(str(result.get(agent_name, {})))
                )
                global_metrics.record_agent_execution(agent_name, agent_metrics)
            
            return result
        
        except Exception as e:
            print(f"[ERROR] Orchestration failed: {str(e)}")
            return {'error': str(e), 'job_id': job_spec.get('id')}
    
    def _get_agent(self, agent_name: str):
        """Factory method to get agent by name"""
        # Import dynamically to avoid circular deps
        # In real implementation, use proper agent factory
        from coordinator import AgentTask
        
        timeout = 30
        if agent_name == 'collector':
            return AgentTask(name='collector', agent_func=self._collector_agent, timeout_sec=timeout)
        elif agent_name == 'drafter':
            return AgentTask(name='drafter', agent_func=self._drafter_agent, timeout_sec=timeout)
        elif agent_name == 'validator':
            return AgentTask(name='validator', agent_func=self._validator_agent, timeout_sec=timeout)
        return None
    
    async def _collector_agent(self, context: Dict, global_state) -> Dict:
        """Placeholder collector logic"""
        await asyncio.sleep(0.1)  # Simulate work
        return {'collected': 'civic_data', 'artifacts': {}}
    
    async def _drafter_agent(self, context: Dict, global_state) -> Dict:
        """Placeholder drafter logic"""
        await asyncio.sleep(0.2)  # Simulate work
        return {'drafted': 'civic_code', 'artifacts': {}}
    
    async def _validator_agent(self, context: Dict, global_state) -> Dict:
        """Placeholder validator logic"""
        await asyncio.sleep(0.15)  # Simulate work
        return {'validated': True, 'artifacts': {}}

# ============================================================================
# EXAMPLE USAGE - How to integrate into existing pipeline
# ============================================================================

async def main():
    """Example: Run orchestrated agents for civic platform"""
    
    orchestrator = CivicOrchestrator()
    
    job_spec = {
        'id': 'civic-mvp-001',
        'task': {
            'objective': 'Risk assessment pipeline',
            'requirements': ['collect_data', 'generate_risk_engine', 'validate_output']
        },
        'constraints': [
            'deadline: Dec 12, 2025',
            'stack: Python+AsyncIO',
            'security: No hardcoded secrets'
        ],
        'agents': ['collector', 'drafter', 'validator']
    }
    
    # This runs ALL agents PARALELLY via asyncio.gather
    result = await orchestrator.run(job_spec)
    
    # Get live metrics
    dashboard = global_metrics.get_dashboard_data()
    print(f"Result: {result}")
    print(f"Dashboard: {dashboard}")
    
    return result

if __name__ == '__main__':
    asyncio.run(main())
