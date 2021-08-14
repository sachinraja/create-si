# create-si

A cli tool for creating new [simple-icons](https://github.com/simple-icons/simple-icons).

## Installation

```bash
npm i create-si
```

## Usage

Run `create-si` and you will be prompted to fill out several fields to gather information on the icon. It will automatically run `svgo` and `svglint` and place the minified icon in the `icons` directory. It will also add the data to `_data/simple-icons.json` and sort alphabetically. If you must add any additional fields, you can add them there (the cli will log a link to the line number).
