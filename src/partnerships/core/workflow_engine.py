# src/partnerships/core/workflow_engine.py
"""Workflow Engine for orchestrating playbook execution."""

import asyncio
import logging
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import json

logger = logging.getLogger(__name__)

class ExecutionStatus(Enum):
    """Status of workflow execution."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"

class StepStatus(Enum):
    """Status of individual workflow step."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"

@dataclass
class ExecutionContext:
    """Context for workflow execution."""
    execution_id: str
    playbook_id: str
    variables: Dict[str, Any]
    started_at: datetime
    
    def set_variable(self, key: str, value: Any) -> None:
        """Set variable in context."""
        self.variables[key] = value
    
    def get_variable(self, key: str) -> Optional[Any]:
        """Get variable from context."""
        return self.variables.get(key)

@dataclass
class StepResult:
    """Result of step execution."""
    step_id: str
    status: StepStatus
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: int = 0

class WorkflowEngine:
    """Orchestrates playbook execution."""
    
    def __init__(self, connector_registry: Dict[str, Any]):
        """Initialize workflow engine."""
        self.connector_registry = connector_registry
        self.logger = logging.getLogger(__name__)
    
    async def execute_playbook(
        self,
        playbook: Dict[str, Any],
        execution_id: str
    ) -> Dict[str, Any]:
        """Execute playbook."""
        context = ExecutionContext(
            execution_id=execution_id,
            playbook_id=playbook['id'],
            variables={},
            started_at=datetime.utcnow()
        )
        
        execution_result = {
            'execution_id': execution_id,
            'playbook_id': playbook['id'],
            'status': ExecutionStatus.RUNNING.value,
            'steps': [],
            'started_at': context.started_at.isoformat(),
            'completed_at': None
        }
        
        try:
            steps = playbook.get('steps', [])
            dependency_graph = self._build_dependency_graph(steps)
            
            for step in dependency_graph.topological_sort():
                step_result = await self._execute_step(step, context)
                execution_result['steps'].append({
                    'step_id': step['id'],
                    'status': step_result.status.value,
                    'output': step_result.output,
                    'error': step_result.error,
                    'duration_ms': step_result.duration_ms
                })
                
                if step_result.status == StepStatus.FAILED:
                    if playbook.get('errorHandling') == 'abort':
                        raise Exception(f"Step failed: {step_result.error}")
            
            execution_result['status'] = ExecutionStatus.SUCCESS.value
            
        except Exception as e:
            execution_result['status'] = ExecutionStatus.FAILED.value
            execution_result['error'] = str(e)
            self.logger.error(f"Playbook execution failed: {e}")
        
        finally:
            execution_result['completed_at'] = datetime.utcnow().isoformat()
        
        return execution_result
    
    async def _execute_step(
        self,
        step: Dict[str, Any],
        context: ExecutionContext
    ) -> StepResult:
        """Execute individual workflow step."""
        step_id = step['id']
        start_time = datetime.utcnow()
        
        try:
            action = step.get('action')
            connector_name = step.get('connector')
            config = step.get('config', {})
            
            if action == 'query':
                result = await self._execute_query_step(connector_name, config, context)
            elif action == 'evaluate':
                result = await self._execute_evaluate_step(config, context)
            elif action == 'template':
                result = await self._execute_template_step(config, context)
            elif action == 'communicate':
                result = await self._execute_communicate_step(connector_name, config, context)
            else:
                raise ValueError(f"Unknown action: {action}")
            
            duration = (datetime.utcnow() - start_time).total_seconds() * 1000
            return StepResult(
                step_id=step_id,
                status=StepStatus.SUCCESS,
                output=result,
                duration_ms=int(duration)
            )
        
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds() * 1000
            self.logger.error(f"Step {step_id} failed: {e}")
            return StepResult(
                step_id=step_id,
                status=StepStatus.FAILED,
                error=str(e),
                duration_ms=int(duration)
            )
    
    async def _execute_query_step(
        self,
        connector_name: str,
        config: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """Execute query step."""
        connector = self.connector_registry.get(connector_name)
        if not connector:
            raise ValueError(f"Connector not found: {connector_name}")
        
        query = config.get('query')
        params = self._interpolate_variables(config.get('params', {}), context)
        
        result = await connector.execute_query(query, params)
        return {'data': result}
    
    async def _execute_evaluate_step(
        self,
        config: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """Execute evaluation step."""
        criteria = config.get('criteria', [])
        passed = True
        
        for criterion in criteria:
            metric = criterion.get('metric')
            threshold = criterion.get('threshold')
            passed = passed and self._evaluate_criterion(metric, threshold, context)
        
        return {'passed': passed}
    
    async def _execute_template_step(
        self,
        config: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """Execute template step."""
        template_name = config.get('template')
        data_mapping = config.get('data_mapping', {})
        
        # Resolve data mapping
        resolved_data = {}
        for key, source in data_mapping.items():
            resolved_data[key] = context.get_variable(source)
        
        return {'template': template_name, 'data': resolved_data}
    
    async def _execute_communicate_step(
        self,
        connector_name: str,
        config: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """Execute communication step."""
        connector = self.connector_registry.get(connector_name)
        if not connector:
            raise ValueError(f"Connector not found: {connector_name}")
        
        recipients = config.get('recipients', [])
        template = config.get('template')
        
        result = await connector.send_message(recipients, template, context.variables)
        return {'sent_count': len(result)}
    
    def _build_dependency_graph(self, steps: List[Dict[str, Any]]) -> 'DependencyGraph':
        """Build dependency graph for steps."""
        return DependencyGraph(steps)
    
    def _interpolate_variables(
        self,
        data: Dict[str, Any],
        context: ExecutionContext
    ) -> Dict[str, Any]:
        """Interpolate variables in data."""
        result = {}
        for key, value in data.items():
            if isinstance(value, str) and value.startswith('${'):
                var_name = value[2:-1]
                result[key] = context.get_variable(var_name)
            else:
                result[key] = value
        return result
    
    def _evaluate_criterion(
        self,
        metric: str,
        threshold: str,
        context: ExecutionContext
    ) -> bool:
        """Evaluate criterion."""
        value = context.get_variable(metric)
        if value is None:
            return False
        
        # Simple evaluation - can be extended
        if '>' in threshold:
            target = float(threshold.split('>')[-1])
            return value > target
        elif '<' in threshold:
            target = float(threshold.split('<')[-1])
            return value < target
        
        return False

class DependencyGraph:
    """Manages dependencies between workflow steps."""
    
    def __init__(self, steps: List[Dict[str, Any]]):
        """Initialize dependency graph."""
        self.steps = {step['id']: step for step in steps}
        self.adjacency = self._build_adjacency(steps)
    
    def _build_adjacency(self, steps: List[Dict[str, Any]]) -> Dict[str, List[str]]:
        """Build adjacency list."""
        adj = {step['id']: step.get('dependencies', []) for step in steps}
        return adj
    
    def topological_sort(self) -> List[Dict[str, Any]]:
        """Return steps in topological order."""
        visited = set()
        result = []
        
        def visit(step_id: str) -> None:
            if step_id in visited:
                return
            visited.add(step_id)
            
            for dep_id in self.adjacency.get(step_id, []):
                visit(dep_id)
            
            result.append(self.steps[step_id])
        
        for step_id in self.steps:
            visit(step_id)
        
        return result
