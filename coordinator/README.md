# Coordinator: Parallel Agent Orchestration

## Overview

The **Coordinator** module implements a production-ready orchestration layer for running multiple AI agents in parallel with a **global job context** as the single source of truth.

### Key Features

- **Global Job Context (Blackboard Pattern)**: Centralized state management that all agents read and update
- **Role-Based Context Filtering**: Each agent receives only relevant context fields
- **Parallel Execution**: asyncio.gather for true concurrency
- **Resilience**: Retry logic with exponential backoff, timeout handling, metrics tracking
- **Agent Coordination**: Automatic result merging and artifact synchronization

## Architecture

### Three Independent Agents

1. **Collector Agent**: Extracts & normalizes context from code/docs
2. **Drafter Agent**: Generates code patches & implementation
3. **Validator Agent**: Creates tests & validation checklists

Each agent:
- Runs in parallel via `asyncio.gather()`
- Receives filtered context via `global_state.get_agent_context(role)`
- Updates global state with results via `global_state.update_agent_state()`

### Global Job Context

```python
job_context = JobContext(
    job_id="mvp-2024-12-11-001",
    task={"requirements": [...], "description": "..."}, 
    artifacts={"code_files": {...}},
    constraints=["deadline: Dec 12 EOD", "stack: Python+FastAPI"],
    decisions=[...]
)
```

## Usage

```python
from coordinator import JobCoordinator, JobContext, AgentTask

# 1. Create global context
job_context = JobContext(job_id="job-123")
job_context.task = {"requirements": ["feature_x"]}

# 2. Initialize coordinator
coord = JobCoordinator(job_context)

# 3. Register agents
coord.register_agent(AgentTask(
    name='collector',
    agent_func=my_collector_agent,  # async function
    timeout_sec=30,
    max_retries=2
))

# 4. Execute in parallel
result = await coord.execute_parallel()

# 5. Access metrics
metrics = coord.get_metrics()
print(f"Collector latency: {metrics['agents']['collector']['total_latency_ms']}ms")
```

## Resilience Features

- **Timeouts**: Each agent has a `timeout_sec` parameter
- **Retries**: Exponential backoff (0.5s, 1s, 2s, ...)
- **Error Handling**: Failed agents don't block others; results merged with status
- **Metrics**: Track latency, attempts, success rate per agent

## Next Steps

- [ ] Implement `metrics.py` for Prometheus/OpenTelemetry export
- [ ] Add circuit breaker for cascading failures
- [ ] Create integration tests for state consistency
- [ ] Deploy & monitor metrics per agent
- [ ] Add dynamic agent discovery
