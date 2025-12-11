from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from enum import Enum
from datetime import datetime

class AgentStatus(Enum):
    """Agent execution status"""
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"

@dataclass
class AgentState:
    """Track individual agent state"""
    name: str
    status: AgentStatus = AgentStatus.PENDING
    progress: float = 0.0
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    
    @property
    def latency_ms(self) -> float:
        if self.timestamp_start and self.timestamp_end:
            return (self.timestamp_end - self.timestamp_start) * 1000
        return 0.0

@dataclass
class JobContext:
    """
    Global Job Context - Single Source of Truth for parallel agents.
    All agents read filtered slices of this context.
    """
    job_id: str
    task: Dict[str, Any] = field(default_factory=dict)
    artifacts: Dict[str, Any] = field(default_factory=dict)
    constraints: List[str] = field(default_factory=list)
    decisions: List[Dict[str, Any]] = field(default_factory=list)
    agent_state: Dict[str, AgentState] = field(default_factory=dict)
    timestamp_created: float = field(default_factory=lambda: datetime.now().timestamp())
    
    def __post_init__(self):
        """Initialize agent states"""
        if not self.agent_state:
            self.agent_state = {
                'collector': AgentState(name='collector'),
                'drafter': AgentState(name='drafter'),
                'validator': AgentState(name='validator')
            }
    
    def get_agent_context(self, role: str) -> Dict[str, Any]:
        """
        Role-based context filtering.
        Each agent gets only relevant context fields.
        """
        filters = {
            'collector': ['task', 'constraints'],
            'drafter': ['task', 'artifacts', 'decisions', 'constraints'],
            'validator': ['task', 'artifacts', 'constraints']
        }
        
        relevant_keys = filters.get(role, [])
        return {k: getattr(self, k) for k in relevant_keys if hasattr(self, k)}
    
    def update_agent_state(self, agent_name: str, status: AgentStatus, 
                          result: Optional[Dict] = None, error: Optional[str] = None):
        """Update agent state in global context"""
        if agent_name in self.agent_state:
            self.agent_state[agent_name].status = status
            if result:
                self.agent_state[agent_name].result = result
            if error:
                self.agent_state[agent_name].error = error
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize context to dict"""
        return {
            'job_id': self.job_id,
            'task': self.task,
            'artifacts': self.artifacts,
            'constraints': self.constraints,
            'decisions': self.decisions,
            'agent_state': {
                name: {
                    'status': state.status.value,
                    'progress': state.progress,
                    'latency_ms': state.latency_ms,
                    'error': state.error
                }
                for name, state in self.agent_state.items()
            }
        }
