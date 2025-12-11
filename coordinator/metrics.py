"""Metrics collection and monitoring for orchestrated agents."""
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
import json
from datetime import datetime


class MetricType(Enum):
    """Metric types for agent execution."""
    LATENCY = "latency"
    ERROR_COUNT = "error_count"
    RETRY_COUNT = "retry_count"
    TIMEOUT_COUNT = "timeout_count"
    SUCCESS_COUNT = "success_count"
    AGENT_STATE = "agent_state"
    EXECUTION_TIME = "execution_time"


@dataclass
class AgentMetrics:
    """Per-agent execution metrics."""
    agent_id: str
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    duration: Optional[float] = None
    status: str = "pending"
    error_count: int = 0
    retry_count: int = 0
    timeout_count: int = 0
    success: bool = False
    result: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    
    def mark_complete(self, success: bool, error_msg: Optional[str] = None):
        """Mark agent execution as complete."""
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
        self.success = success
        self.status = "success" if success else "failed"
        self.error_message = error_msg
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "agent_id": self.agent_id,
            "status": self.status,
            "duration_ms": round(self.duration * 1000) if self.duration else None,
            "success": self.success,
            "error_count": self.error_count,
            "retry_count": self.retry_count,
            "timeout_count": self.timeout_count,
            "error_message": self.error_message,
        }


class MetricsCollector:
    """Centralized metrics collection and dashboard."""
    
    def __init__(self):
        self.agent_metrics: Dict[str, AgentMetrics] = {}
        self.job_metrics: Dict[str, Any] = {}
        self.start_time = time.time()
        self.end_time: Optional[float] = None
    
    def start_agent(self, agent_id: str) -> AgentMetrics:
        """Record the start of an agent execution."""
        metrics = AgentMetrics(agent_id=agent_id)
        self.agent_metrics[agent_id] = metrics
        return metrics
    
    def record_error(self, agent_id: str, error_msg: str, is_timeout: bool = False):
        """Record an error for an agent."""
        if agent_id in self.agent_metrics:
            metrics = self.agent_metrics[agent_id]
            metrics.error_count += 1
            if is_timeout:
                metrics.timeout_count += 1
    
    def record_retry(self, agent_id: str):
        """Record a retry attempt for an agent."""
        if agent_id in self.agent_metrics:
            self.agent_metrics[agent_id].retry_count += 1
    
    def end_agent(self, agent_id: str, success: bool, error_msg: Optional[str] = None, result: Optional[Dict] = None):
        """Record the completion of an agent execution."""
        if agent_id in self.agent_metrics:
            metrics = self.agent_metrics[agent_id]
            metrics.mark_complete(success, error_msg)
            metrics.result = result
    
    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get current metrics dashboard data."""
        self.end_time = time.time()
        total_duration = self.end_time - self.start_time
        
        agent_list = [m.to_dict() for m in self.agent_metrics.values()]
        successful = sum(1 for m in self.agent_metrics.values() if m.success)
        failed = len(self.agent_metrics) - successful
        
        return {
            "timestamp": datetime.now().isoformat(),
            "total_duration_ms": round(total_duration * 1000),
            "total_agents": len(self.agent_metrics),
            "successful_agents": successful,
            "failed_agents": failed,
            "agents": agent_list,
            "summary": {
                "total_errors": sum(m.error_count for m in self.agent_metrics.values()),
                "total_retries": sum(m.retry_count for m in self.agent_metrics.values()),
                "total_timeouts": sum(m.timeout_count for m in self.agent_metrics.values()),
            }
        }
    
    def to_json(self) -> str:
        """Export metrics as JSON."""
        return json.dumps(self.get_dashboard_data(), indent=2)


# Global metrics instance
global_metrics = MetricsCollector()
