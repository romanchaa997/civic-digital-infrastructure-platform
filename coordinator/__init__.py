"""Coordinator package for parallel agent orchestration.

Provides global job context management and parallel execution
of independent agents with role-based context filtering.
"""

from .job_context import JobContext, AgentStatus, AgentState
from .coordinator import JobCoordinator, AgentTask

__all__ = [
    'JobContext',
    'AgentStatus',
    'AgentState',
    'JobCoordinator',
    'AgentTask'
]

__version__ = '0.1.0'
