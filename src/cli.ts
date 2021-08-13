import { Builtins, Cli } from 'clipanion'
import RootCommand from './commands/root'

const cli = new Cli({
  binaryLabel: 'create-si',
  binaryName: 'create-si',
  binaryVersion: '1.0.0',
})

cli.register(Builtins.HelpCommand)
cli.register(Builtins.VersionCommand)

cli.register(RootCommand)

export default cli
