.PHONY: up down logs test

up:
	docker compose -f docker/compose.local.yml up --build -d

down:
	docker compose -f docker/compose.local.yml down

logs:
	docker compose -f docker/compose.local.yml logs -f

test:
	docker compose -f docker/compose.local.yml run --rm backend pytest -q
