BIN := node_modules/.bin

all: server.js

$(BIN)/tsc:
	npm install

%.js: %.ts $(BIN)/tsc
	$(BIN)/tsc
