const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const baseExec = require('child_process').exec
const ora = require('ora')
const spinner = ora()

function link ({ linkAppName, cleanup, deep, ignore }) {
  const rootPath = process.cwd()
  const mainAppName = _.chain(rootPath)
    .split('/')
    .takeRight(1)
    .first()
    .value()
  const codePath = _.chain(rootPath)
    .split('/')
    .dropRight(1)
    .join('/')
    .value()
  const linkAppPath = _.chain(rootPath)
    .split('/')
    .dropRight(1)
    .concat([linkAppName])
    .join('/')
    .value()
  const mainAppPath = _.chain(rootPath)
    .split('/')
    .dropRight(1)
    .concat([mainAppName])
    .join('/')
    .value()
  return fetchPackagesToLink({ codePath, mainAppName, mainAppPath, linkAppName, linkAppPath, ignore })
    .then(packageNamesToLink => {
      const reinstallAllDependencies = () => {
        if (cleanup) {
          return _.chain(packageNamesToLink)
            .map(({ dependencyName }) => dependencyName)
            .concat([mainAppName])
            .uniq()
            .map(dependencyName => () => npmInstall({ codePath, dependencyName }))
            .reduce((memo, next) => memo.then(next), Promise.resolve())
            .value()
        } else {
          return Promise.resolve()
        }
      }
      const buildAllDependencies = () => {
        if (cleanup) {
          return _.chain(packageNamesToLink)
            .map(({ dependencyName }) => dependencyName)
            .concat([mainAppName])
            .uniq()
            .map(dependencyName => () => build({ codePath, dependencyName }))
            .reduce((memo, next) => memo.then(next), Promise.resolve())
            .value()
        } else {
          return Promise.resolve()
        }
      }
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
        .then(buildAllDependencies)
        .then(linkAllDependencies)
        .then(linkAllPackages)
    })
}


function fetchPackagesToLink ({ codePath, mainAppName, mainAppPath, deep, ignore }) {
  return Promise
    .all([
      fetchPackageJson(`${mainAppPath}/package.json`),
      fetchLocalCodeFolderDirectoryPackageJsons({ codePath, ignore })
    ])
    .then(([ mainAppPackageJson, localCodeFolderDirectoryPackageJsons ]) => {
      const mainPackageDependencyNames = getPackageJsonDependencyNames(mainAppPackageJson)
      const locallyAvailableDependencyNamesForMainAppPackage = _.chain(localCodeFolderDirectoryPackageJsons)
        .map(packageJson => packageJson.name)
        .intersectionWith(mainPackageDependencyNames)
        .value()
      const locallyAvailableDependenciesForMainAppPackage = {
        packageName: mainAppName,
        dependencies: locallyAvailableDependencyNamesForMainAppPackage
      }
      const localPackageDependencies = deep
        ? _.chain(localCodeFolderDirectoryPackageJsons)
          .map(packageJson => ({
            packageName: packageJson.name,
            dependencies: _.chain(getPackageJsonDependencyNames(packageJson))
              .intersection(locallyAvailableDependencyNamesForMainAppPackage)
              .value()
          }))
          .reject(({ dependencies }) => _.isEmpty(dependencies))
          .value()
        : []
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

function build ({ codePath, dependencyName }) {
  const command = 'npm run build'
  const commandText = `[slex-link]: ${dependencyName} => ${command}`
  spinner.start(commandText)
  return exec(command, { cwd: `${codePath}/${dependencyName}` })
    .then(() => {
      spinner.succeed(commandText)
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

module.exports = link