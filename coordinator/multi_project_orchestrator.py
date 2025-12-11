"""Multi-project orchestrator for parallel execution across all projects."""
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime
from metrics import global_metrics


@dataclass
class ProjectJobSpec:
    """Job specification for a project."""
    project_id: str
    project_name: str
    job_id: str
    description: str
    agents: List[str]
    priority: int = 1
    timeout: float = 120.0


class MultiProjectOrchestrator:
    """Master orchestrator for running multiple project orchestrators in parallel."""
    
    def __init__(self):
        self.projects: Dict[str, Any] = {}
        self.project_results: Dict[str, Any] = {}
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.execution_report: Dict[str, Any] = {}
    
    def register_project(self, project_id: str, orchestrator: Any):
        """Register a project orchestrator."""
        self.projects[project_id] = orchestrator
    
    async def run_all(self, job_specs: Dict[str, ProjectJobSpec]) -> Dict[str, Any]:
        """Run all registered projects in parallel.
        
        Args:
            job_specs: Mapping of project_id to ProjectJobSpec.
        
        Returns:
            Aggregated results from all projects.
        """
        import time
        self.start_time = time.time()
        
        # Create tasks for all projects
        tasks = []
        task_to_project = {}
        
        for project_id, job_spec in job_specs.items():
            if project_id not in self.projects:
                print(f"Warning: Project {project_id} not registered")
                continue
            
            orchestrator = self.projects[project_id]
            # Prepare job spec as dict for orchestrator
            job_dict = {
                "job_id": job_spec.job_id,
                "description": job_spec.description,
                "agents": job_spec.agents,
            }
            
            task = asyncio.create_task(orchestrator.run(job_dict))
            tasks.append(task)
            task_to_project[id(task)] = project_id
        
        # Execute all projects in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Map results back to projects
        for i, task in enumerate(tasks):
            project_id = task_to_project.get(id(task))
            result = results[i]
            
            if isinstance(result, Exception):
                self.project_results[project_id] = {
                    "status": "failed",
                    "error": str(result),
                    "project_id": project_id
                }
            else:
                self.project_results[project_id] = result
        
        self.end_time = time.time()
        return self._generate_report()
    
    def _generate_report(self) -> Dict[str, Any]:
        """Generate aggregated execution report."""
        from metrics import global_metrics
        
        if self.start_time and self.end_time:
            total_duration = self.end_time - self.start_time
        else:
            total_duration = 0
        
        successful_projects = sum(
            1 for r in self.project_results.values() 
            if isinstance(r, dict) and r.get("status") == "success"
        )
        
        self.execution_report = {
            "timestamp": datetime.now().isoformat(),
            "total_duration_ms": round(total_duration * 1000),
            "total_projects": len(self.project_results),
            "successful_projects": successful_projects,
            "failed_projects": len(self.project_results) - successful_projects,
            "project_results": self.project_results,
            "global_metrics": global_metrics.get_dashboard_data() if global_metrics else {},
        }
        
        return self.execution_report
    
    def get_report(self) -> Dict[str, Any]:
        """Get the execution report."""
        return self.execution_report


# Global instance
multi_project_orchestrator = MultiProjectOrchestrator()
