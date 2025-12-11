"""Agent factory for creating and managing orchestrated agents."""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, Any, Optional, Callable, Awaitable
import asyncio
from dataclasses import dataclass
from job_context import JobContext
from metrics import global_metrics


class AgentType(Enum):
    """Available agent types."""
    COLLECTOR = "collector"
    DRAFTER = "drafter"
    VALIDATOR = "validator"
    CUSTOM = "custom"


class AgentState(Enum):
    """Agent execution states."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class AgentTask:
    """Definition of an agent task."""
    agent_id: str
    agent_type: AgentType
    role: str
    task: str
    timeout: float = 30.0
    max_retries: int = 3
    execute_fn: Optional[Callable] = None
    context_filter: Optional[Callable] = None


class BaseAgent(ABC):
    """Abstract base class for orchestrated agents."""
    
    def __init__(self, agent_id: str, agent_type: AgentType, role: str, timeout: float = 30.0):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.role = role
        self.timeout = timeout
        self.state = AgentState.PENDING
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
    
    @abstractmethod
    async def execute(self, job_context: JobContext, filtered_context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute agent with provided context."""
        pass
    
    async def run_with_timeout(self, job_context: JobContext, filtered_context: Dict[str, Any]) -> Dict[str, Any]:
        """Run agent execution with timeout protection."""
        self.state = AgentState.RUNNING
        global_metrics.start_agent(self.agent_id)
        
        try:
            result = await asyncio.wait_for(
                self.execute(job_context, filtered_context),
                timeout=self.timeout
            )
            self.state = AgentState.SUCCESS
            self.result = result
            global_metrics.end_agent(self.agent_id, success=True, result=result)
            return result
        except asyncio.TimeoutError:
            self.state = AgentState.TIMEOUT
            self.error = f"Timeout after {self.timeout}s"
            global_metrics.record_error(self.agent_id, self.error, is_timeout=True)
            global_metrics.end_agent(self.agent_id, success=False, error_msg=self.error)
            return {"error": self.error, "agent_id": self.agent_id}
        except Exception as e:
            self.state = AgentState.FAILED
            self.error = str(e)
            global_metrics.record_error(self.agent_id, self.error)
            global_metrics.end_agent(self.agent_id, success=False, error_msg=self.error)
            return {"error": self.error, "agent_id": self.agent_id}


class CollectorAgent(BaseAgent):
    """Agent for data collection."""
    
    async def execute(self, job_context: JobContext, filtered_context: Dict[str, Any]) -> Dict[str, Any]:
        """Collect data from sources."""
        # Placeholder: implement actual data collection
        return {
            "agent_id": self.agent_id,
            "collected_data": {"sample": "data"},
            "status": "success"
        }


class DrafterAgent(BaseAgent):
    """Agent for code drafting."""
    
    async def execute(self, job_context: JobContext, filtered_context: Dict[str, Any]) -> Dict[str, Any]:
        """Draft code or content."""
        # Placeholder: implement actual drafting
        return {
            "agent_id": self.agent_id,
            "draft": "# Generated code",
            "status": "success"
        }


class ValidatorAgent(BaseAgent):
    """Agent for validation and testing."""
    
    async def execute(self, job_context: JobContext, filtered_context: Dict[str, Any]) -> Dict[str, Any]:
        """Validate results."""
        # Placeholder: implement actual validation
        return {
            "agent_id": self.agent_id,
            "validation_result": "passed",
            "status": "success"
        }


class AgentFactory:
    """Factory for creating agents."""
    
    _agent_classes: Dict[AgentType, type] = {
        AgentType.COLLECTOR: CollectorAgent,
        AgentType.DRAFTER: DrafterAgent,
        AgentType.VALIDATOR: ValidatorAgent,
    }
    
    @classmethod
    def create_agent(cls, agent_id: str, agent_type: AgentType, role: str, timeout: float = 30.0) -> BaseAgent:
        """Create an agent instance."""
        agent_class = cls._agent_classes.get(agent_type)
        if not agent_class:
            raise ValueError(f"Unknown agent type: {agent_type}")
        return agent_class(agent_id, agent_type, role, timeout)
    
    @classmethod
    def register_agent_type(cls, agent_type: AgentType, agent_class: type):
        """Register a custom agent type."""
        if not issubclass(agent_class, BaseAgent):
            raise TypeError(f"{agent_class} must be a subclass of BaseAgent")
        cls._agent_classes[agent_type] = agent_class
    
    @classmethod
    def get_available_types(cls) -> list:
        """Get all available agent types."""
        return list(cls._agent_classes.keys())
