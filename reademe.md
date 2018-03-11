# Slex Link

```
$ npm install slex-link -g
```

`slex-link` is a simple cli designed to npm link locally available packages to your code project.

## Installation

`npm install slex-link -g`

## Usage

```
  $ slex-app --help

	Usage
	  $ slex-link <options>
	Options
	  --cleanup Removes and reinstalls node_modules in all linked folders
	  --deep Links linked folders to their npm linkable projects in the code directory
	  --ignore Accepts comma separated list of package names to ignore when linking
	Examples
	  $ slex-link --cleanup 
	  $ slex-link --deep
	  $ slex-link --ignore package1
	  $ slex-link --ignore package1,package2
```

## Rationale

If you're like me you try to modularise your code where possible. For many large projects this leads to a directory structure where all your code is in the same folder but its set up to get its dependencies via npm. e.g.

```
- code
  - client-app
    package.json: {
      "dependencies": {
        "sdk": "1.0.0",
        "components": "1.0.0",
        "@myPrivateRepo/core": "1.0.0"
      }
    }
  - server-app
    package.json: {
      "dependencies": {
        "@myPrivateRepo/core": "1.0.0"
      }
    }
  - sdk
    package.json: {
      "name": "sdk:
    }
  - components
    package.json: {
      "name": "sdk:
    }
  - core
    package.json: {
      "name": "@myPrivateRepo/core:
    }
```

If youre clever you use `npm link` to link the dependencies you have locally available to develop your system together e.g.

```
  $ cd client-app
  $ npm link ../sdk
  $ npm link sdk
  $ npm link ../components
  $ npm link components
  $ npm link ../core
  $ npm link @myPrivateRepo/core
```

If youre pro you use `slex-link` e.g.

```
  $ cd client-app
  $ slex-link
```
