.PHONY: build dev pack release clean

build:
	yarn build

dev:
	yarn dev

pack: build
	rm -f lark-project-linker.zip
	cd dist && zip -r ../lark-project-linker.zip .
	@echo "✓ lark-project-linker.zip ($$(du -h lark-project-linker.zip | cut -f1 | xargs))"

release: pack

clean:
	rm -rf dist lark-project-linker.zip
