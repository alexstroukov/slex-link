const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const baseExec = require('child_process').exec
const ora = require('ora')
const spinner = ora()


linkAll({ mainAppName: 'SLEXAPP', scriptsAppName: 'slex-link' })

function linkAll ({ mainAppName, scriptsAppName }) {
  const rootPath = path.resolve(__dirname)
  const codePath = path.resolve(`../`)
  const scriptsAppPath = path.resolve(`../${scriptsAppName}`)
  const mainAppPath = path.resolve(`../${mainAppName}`)
  return fetchPackagesToLink({ codePath, mainAppName, mainAppPath, scriptsAppName, scriptsAppPath })
    .then(packageNamesToLink => {
  
      const reinstallAllDependencies = () => _.chain(packageNamesToLink)
        .map(({ dependencyName }) => dependencyName)
        .concat([mainAppName])
        .uniq()
        .map(dependencyName => () => npmInstall({ codePath, dependencyName }))
        .reduce((memo, next) => memo.then(next), Promise.resolve())
        .value()
      const linkAllDependencies = () => _.chain(packageNamesToLink)
        .map(({ dependencyName }) => dependencyName)
        .uniq()
        .map(dependencyName => () => addLink({ codePath, dependencyName }))
        .reduce((memo, next) => memo.then(next), Promise.resolve())
        .value()
      const linkAllPackages = () => _.chain(packageNamesToLink)
        .map(({ packageName, dependencyName }) => () => linkToPackage({ codePath, packageName, dependencyName }))
        .reduce((memo, next) => memo.then(next), Promise.resolve())
        .value()
      return reinstallAllDependencies()
        .then(linkAllDependencies)
        .then(linkAllPackages)
    })
}


function fetchPackagesToLink ({ codePath, mainAppName, mainAppPath, scriptsAppName, scriptsAppPath }) {
  return Promise
    .all([
      fetchPackageJson(`${mainAppPath}/package.json`),
      fetchPackageJson(`${scriptsAppPath}/package.json`),
      fetchLocalCodeFolderDirectoryPackageJsons({ codePath, ignore: ['SLEXAPP', 'slex-link'] })
    ])
    .then(([ mainAppPackageJson, linkScriptPackageJson, localCodeFolderDirectoryPackageJsons ]) => {
      const mainPackageDependencyNames = getPackageJsonDependencyNames(mainAppPackageJson)
      const locallyAvailableDependencyNamesForMainAppPackage = _.chain(localCodeFolderDirectoryPackageJsons)
        .map(packageJson => packageJson.name)
        .intersectionWith(mainPackageDependencyNames)
        .value()
      const locallyAvailableDependenciesForMainAppPackage = {
        packageName: mainAppName,
        dependencies: locallyAvailableDependencyNamesForMainAppPackage
      }
      const localPackageDependencies = _.chain(localCodeFolderDirectoryPackageJsons)
        .map(packageJson => ({
          packageName: packageJson.name,
          dependencies: _.chain(getPackageJsonDependencyNames(packageJson))
            .intersection(locallyAvailableDependencyNamesForMainAppPackage)
            .value()
        }))
        .reject(({ dependencies }) => _.isEmpty(dependencies))
        .value()
      const packagesToLink = _.chain([...localPackageDependencies, locallyAvailableDependenciesForMainAppPackage ])
        .map(({ packageName, dependencies }) => _.chain(dependencies)
          .map(dependencyName => ({ packageName, dependencyName }))
          .value()
        )
        .flatten()
        .value()
      return packagesToLink
    })
}

function getPackageJsonDependencyNames (packageJson) {
  const packageJsonDependencyNames = _.chain(packageJson)
    .at(['dependencies', 'devDependencies'])
    .map(_.keys)
    .flatten()
    .uniq()
    .value()
  return packageJsonDependencyNames
}

function fetchLocalCodeFolderDirectoryPackageJsons ({ codePath, ignore = [] }) {
  return _.chain(fs.readdirSync(codePath))
    .filter(filePath => {
      try {
        const isDirectory = fs
          .statSync(path.join(codePath, filePath))
          .isDirectory()
        return isDirectory && !ignore.includes(filePath)
      } catch (error) {
        return false
      }
    })
    .map(directoryName => fetchPackageJson(`${codePath}/${directoryName}/package.json`))
    .thru(promises => Promise.all(promises))
    .value()
}

function fetchPackageJson (path) {
  return readFile(path)
    .then(packageJsonString => {
      try {
        return JSON.parse(packageJsonString)
      } catch (error) {
        return {}
      }
    })
}

function npmInstall ({ codePath, dependencyName }) {
  const command = 'npm install'
  const commandText = `[slex-link]: ${dependencyName} => ${command}`
  spinner.start(commandText)
  return exec(`rm -rf node_modules`, { cwd: `${codePath}/${dependencyName}` })
    .then(() => exec(command, { cwd: `${codePath}/${dependencyName}` }))
    .then(() => {
      spinner.succeed(commandText)
    })
}

function addLink ({ codePath, dependencyName }) {
  const command = 'npm link'
  const commandText = `[slex-link]: ${dependencyName} => ${command}`
  spinner.start(commandText)
  return exec(command, { cwd: `${codePath}/${dependencyName}` })
    .then(() => {
      spinner.succeed(commandText)
    })
}

function linkToPackage ({ codePath, packageName, dependencyName }) {
  const command = `npm link ${dependencyName}`
  const commandText = `[slex-link]: ${packageName} => ${command}`
  spinner.text = commandText
  return exec(command, { cwd: `${codePath}/${packageName}` })
    .then(() => {
      spinner.succeed(commandText)
    })
}

function exec (command, options) {
  return new Promise((resolve, reject) => {
    baseExec(command, options, (err, stdout, stderr) => {
      if (err) {
        console.error(err)
        reject(err)
      } else if (stderr) {
        resolve(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

function readFile (location) {
  return new Promise((resolve, reject) => {
    fs.readFile(location, 'utf8', function (err, data) {
      if (err) {
        console.error(`failed to read file ${location}. Error: ${err}`)
        reject(err)
      } else {
        resolve(data)
      }
    })
  })
}

// const inquirer = require('inquirer')

// const envChoices = ['admin', 'cms', 'api']
// const configChoices = ['local', 'develop']

// prompt()

// function prompt () {
//   const env = process.argv[2]
//   const config = process.argv[3]
//   if (env && config && isValidConfig(config) && isValidEnv(env)) {
//     return changeEnv({ env, config })
//   } else {
//     return promptEnv()
//       .then(({ env }) => {
//         return promptConfig()
//           .then(({ config }) => {
//             return changeEnv({ env, config })
//           })
//       })
//   }
// }

// function changeEnvironment ({ env }) {
//   return readFile(`./env/${env}/index.js`)
//     .then(content => writeFile(`./index.js`, content))
// }
// function changeServerConfig ({ env, config }) {
//   return readFile(`./env/${env}/server/${config}.js`)
//     .then(content => writeFile(`./${env}App/server/env.js`, content))
// }
// function changeClientConfig ({ env, config }) {
//   return readFile(`./env/${env}/client/${config}.js`)
//     .then(content => writeFile(`./${env}App/client/env.js`, content))
// }

// function promptEnv () {
//   return inquirer
//     .prompt([{
//       type: 'list',
//       name: 'env',
//       message: 'Pick an environment',
//       choices: envChoices
//     }])
// }

// function promptConfig () {
//   return inquirer
//     .prompt([{
//       type: 'list',
//       name: 'config',
//       message: 'Pick a configuration',
//       choices: configChoices
//     }])
// }

// function changeEnv ({ env, config }) {
//   const changeEnvironmentPromise = changeEnvironment({ env })
//   const changeServerConfigPromise = changeServerConfig({ env, config })
//   const changeClientConfigPromise = env !== 'api' && changeClientConfig({ env, config })
//   return Promise
//     .all([
//       changeEnvironmentPromise,
//       changeServerConfigPromise,
//       changeClientConfigPromise
//     ])
// }

// function writeFile (location, content) {
//   return new Promise((resolve, reject) => {
//     fs.writeFile(location, content, 'utf8', function (err, data) {
//       if (err) {
//         console.log(`failed to write file ${location}. Error: ${err}`)
//         reject(err)
//       } else {
//         console.log(`successfully wrote to file ${location} contents ${content}`)
//         resolve(data)
//       }
//     })
//   })
// }

// function readFile (location) {
//   return new Promise((resolve, reject) => {
//     fs.readFile(location, 'utf8', function (err, data) {
//       if (err) {
//         console.log(`failed to read file ${location}. Error: ${err}`)
//         reject(err)
//       } else {
//         console.log(`successfully read file ${location}`)
//         resolve(data)
//       }
//     })
//   })
// }

// function isValidEnv (env) {
//   return envChoices.indexOf(env) >= 0
// }

// function isValidConfig (config) {
//   return configChoices.indexOf(config) >= 0
// }

