server = ubuntu@brorlandi.xyz
project_path = $(shell basename $(shell pwd))

rsync:
	rsync -azv . $(server):$(project_path) --exclude .git --exclude-from .gitignore

deploy: rsync
	ssh $(server) "cd $(project_path) && docker compose down && docker compose up -d --build"

down:
	ssh $(server) "cd $(project_path) && docker compose down"

clear:
	rm -r dependencies-cache executions