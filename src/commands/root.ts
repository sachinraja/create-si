import { existsSync, readFileSync, writeFileSync } from 'fs'
import { Command } from 'clipanion'
import { prompt } from 'enquirer'
import { optimize, loadConfig } from 'svgo'
import cheerio from 'cheerio'
import chalk from 'chalk'
import tempy from 'tempy'
import execa, { ExecaReturnValue } from 'execa'
import titleToSlug from '../utils/title-to-slug'

class RootCommand extends Command {
  static paths = [Command.Default]
  async execute() {
    const {
      filepath,
      title,
      precision,
    }: {
      filepath: string
      title: string
      precision: '3' | '4' | '5'
    } = await prompt([
      {
        type: 'input',
        name: 'filepath',
        message: 'filepath',
        required: true,
        validate(val) {
          const endsWithSvg = val.slice(val.length - 3, val.length) === 'svg'
          const exists = existsSync(val)

          return endsWithSvg && exists
        },
      },
      {
        type: 'input',
        name: 'title',
        message: 'title',
        required: true,
      },
      {
        type: 'select',
        name: 'precision',
        message: 'pick precision',
        required: true,
        choices: ['3', '4', '5'],
      },
    ])

    console.log(chalk.bold.cyan('Running svgo and svglint...'))

    const rawXMLStr = readFileSync(filepath, 'utf-8')

    // @ts-expect-error this does not require any arguments
    const config = await loadConfig()

    // run through svgo
    const { data: resultXMLStr } = optimize(rawXMLStr, {
      path: filepath,
      ...config,
      floatPrecision: parseInt(precision),
    })

    // add title to svg
    const $ = cheerio.load(resultXMLStr, { xmlMode: true })
    $('svg').prepend(`<title>${title}</title>`)
    const iconXml = $.xml()

    // lint
    const procValue = await tempy.file.task(async (tempPath) => {
      writeFileSync(tempPath, iconXml, 'utf-8')

      let execaValue: ExecaReturnValue<string>

      try {
        const insideProc = execa('node_modules/.bin/svglint', [
          tempPath,
          '--ci',
        ])

        insideProc.stdout?.pipe(process.stdout)

        execaValue = await insideProc
      } catch (e) {}

      // @ts-expect-error execa only throws an error after execution
      // so `insideProc` will have a value
      return execaValue
    })

    if (procValue?.exitCode !== 0) {
      console.log(
        chalk.red('Exiting, you must fix the linting errors to continue.')
      )

      return procValue?.exitCode ?? 1
    }

    const { hex, source, slug }: { hex: string; source: string; slug: string } =
      await prompt([
        {
          type: 'input',
          name: 'hex',
          message: 'hex',
          required: true,
          validate(val) {
            return /^#?[0-9A-F]{6}$/i.test(val)
          },
        },
        {
          type: 'input',
          name: 'source',
          message: 'source (link)',
          required: true,
        },
        {
          type: 'input',
          name: 'slug',
          message: 'slug',
          initial: titleToSlug(title),
          required: true,
        },
        {
          type: 'input',
          name: 'guidelines',
          message: 'guidelines (link, leave blank if none)',
        },
      ])
  }
}

export default RootCommand
