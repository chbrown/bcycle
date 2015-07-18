DTS := node/node async/async request/request form-data/form-data

type_declarations: $(DTS:%=type_declarations/%.d.ts)

type_declarations/%:
	mkdir -p $(@D)
	curl -s https://raw.githubusercontent.com/chbrown/DefinitelyTyped/master/$* > $@
