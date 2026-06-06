SHELL := /bin/bash
VENV := .venv
BIN := $(VENV)/bin

.PHONY: install redis down api web test test-agent eval check fmt clean

install:  ## create the venv, install backend + frontend deps
	uv venv $(VENV) --python 3.11
	uv pip install --python $(BIN)/python -r backend/requirements.txt
	cd frontend && npm install

redis:  ## start Redis Stack (6379 = redis, 8001 = RedisInsight)
	docker compose up -d redis

down:  ## stop docker services
	docker compose down

api:  ## run the FastAPI backend (http://localhost:8000)
	cd backend && ../$(BIN)/uvicorn app.main:app --reload --port 8000

web:  ## run the Next.js frontend (http://localhost:3000)
	cd frontend && npm run dev

test:  ## Tier 1 — deterministic unit tests (free, fast)
	$(BIN)/pytest -m "not agent and not eval" -q

test-agent:  ## Tier 2 — agent behavior on fixtures (token cost)
	$(BIN)/pytest -m agent -q

eval:  ## Tier 3 — the Weave evaluation (token cost; the money metric)
	cd backend && ../$(BIN)/python -m eval.run_eval

check:  ## the green gate — must pass before any commit/PR
	$(BIN)/ruff check .
	$(BIN)/ruff format --check .
	$(BIN)/mypy backend/app
	$(BIN)/pytest -m "not agent and not eval" -q
	cd frontend && npm run build

fmt:  ## auto-format + autofix lint
	$(BIN)/ruff format .
	$(BIN)/ruff check --fix .

clean:  ## remove caches + build artifacts
	rm -rf $(VENV) frontend/.next frontend/node_modules
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
