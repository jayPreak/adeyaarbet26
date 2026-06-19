.PHONY: test build dev clean setup

# Run all tests (P0/P1 regression suite)
test:
	npx jest --forceExit

# Run tests in watch mode
test-watch:
	npx jest --watch

# Build production bundle (catches compile errors)
build:
	npx next build --no-lint

# Start dev server (clears cache first)
dev:
	rm -rf .next
	npx next dev

# Full CI check: tests + build
ci: test build

# Clean all caches
clean:
	rm -rf .next node_modules/.cache

# Activate repo-tracked git hooks (run once after cloning)
setup:
	git config core.hooksPath .githooks
