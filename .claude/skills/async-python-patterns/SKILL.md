---
name: async-python-patterns
description: asyncio concurrency for Python workers/bots — tasks & TaskGroup, gather, bounded concurrency (Semaphore), timeouts, queues + backpressure, structured cancellation, and testing async code. Use when a Python worker/bot does concurrent I/O (many API calls, a scraper, a WebSocket/Discord bot, a queue consumer). NOT for CPU-bound work or a simple sync script.
---

# Async Python Patterns (platform-adapted)

> **Adapted from** `development/async-python-patterns` (`davila7/claude-code-templates`). Its SKILL.md was a thin router
> to an external playbook file; this is a **self-contained, condensed** version of the core asyncio patterns (Python
> ≥3.11) for the platform's Python workers/bots, so there's no dangling reference.

Use for **I/O-bound** concurrency. CPU-bound work → a process pool or a different language; a simple linear script → keep
it sync.

## Run concurrent work

```python
import asyncio

# Structured concurrency (3.11+): if any task fails, the group cancels the rest.
async def fetch_all(urls: list[str]) -> list[dict]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(u)) for u in urls]
    return [t.result() for t in tasks]

# gather when you want to keep partial results / per-item exceptions
results = await asyncio.gather(*(fetch(u) for u in urls), return_exceptions=True)
```

## Bound the concurrency (don't open 1000 sockets)

```python
sem = asyncio.Semaphore(10)            # at most 10 in flight
async def guarded(u):
    async with sem:
        return await fetch(u)
await asyncio.gather(*(guarded(u) for u in urls))
```

## Timeouts & cancellation

```python
async with asyncio.timeout(5):         # 3.11+; raises TimeoutError, cancels the block
    await slow_call()

# Always shield cleanup from cancellation, and handle CancelledError correctly:
try:
    await work()
except asyncio.CancelledError:
    await cleanup()                    # do NOT swallow it
    raise                              # re-raise — cancellation must propagate
```

## Producer/consumer with backpressure

```python
async def pipeline(items):
    q: asyncio.Queue = asyncio.Queue(maxsize=100)   # maxsize = backpressure
    async def producer():
        for it in items:
            await q.put(it)            # blocks when full → upstream slows down
        await q.put(None)              # sentinel
    async def consumer():
        while (it := await q.get()) is not None:
            await handle(it)
            q.task_done()
    async with asyncio.TaskGroup() as tg:
        tg.create_task(producer())
        tg.create_task(consumer())
```

## Don't block the event loop

- No `time.sleep()` → `await asyncio.sleep()`. No blocking DB/HTTP libs → use async clients (`httpx`/`aiohttp`,
  async DB drivers) or push the blocking call to `await asyncio.to_thread(blocking_fn, ...)`.
- One `asyncio.run(main())` entrypoint; don't create/close loops manually.

## Testing

```python
import pytest

@pytest.mark.asyncio        # pytest-asyncio
async def test_fetch_all():
    assert await fetch_all([...]) == [...]
```

Use a fake clock / `freezegun` or inject delays to test timeout/cancellation paths. (Python unit-test discipline:
pair with `pytest` fixtures — see the deferred `python-testing-patterns` candidate in the ledger if/when needed.)

## Checklist

- [ ] I/O-bound (not CPU-bound)? Otherwise async won't help.
- [ ] Concurrency bounded (Semaphore/Queue maxsize) — no unbounded fan-out.
- [ ] Every awaited external call has a timeout; `CancelledError` re-raised after cleanup.
- [ ] No blocking call on the event loop (`to_thread` if unavoidable).
- [ ] One `asyncio.run` entrypoint; tasks awaited (no orphan/`create_task` you never await).
