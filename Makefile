.PHONY: dev build test lint sync-ios cloud-test rust-test icon audit

dev:
	npm run dev

build:
	npm run build

test:
	npm test
	cd services/cloud_worker && npm test

lint:
	npx tsc --noEmit
	cd services/cloud_worker && npx tsc --noEmit

sync-ios:
	npm run build
	npx cap sync ios

icon:
	python scripts/generate_ios_icon.py

cloud-test:
	cd services/cloud_worker && npm test

rust-test:
	cd packages/rust_core && cargo test

audit:
	python scripts/store_preflight_audit.py
