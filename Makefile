.PHONY: test build dev clean

# Prepend Node 20 to PATH so `node`, `npx`, and shebang scripts all use v20.
# Node 16 (system default) lacks os.availableParallelism(), which crashes Jest.
export PATH := $(HOME)/.nvm/versions/node/v20.19.2/bin:$(PATH)

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
