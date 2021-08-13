import { existsSync, fstat, readFileSync, write, writeFileSync } from 'fs'
import { join } from 'path'
import { Command } from 'clipanion'
import { prompt } from 'enquirer'
import { optimize, loadConfig } from 'svgo'
import cheerio from 'cheerio'
import chalk from 'chalk'
import execa, { ExecaReturnValue } from 'execa'
import titleToSlug from '../utils/title-to-slug'

class RootCommand extends Command {
  static paths = [Command.Default]
  async execute() {
    const {
      filepath,
      title,
    }: {
      filepath: string
      title: string
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
    ])

    const suggestedSlug = titleToSlug(title)

    const {
      hex,
      source,
      slug,
      guidelines,
      precision,
    }: {
      hex: string
      source: string
      slug: string
      guidelines: string
      precision: '3' | '4' | '5'
    } = await prompt([
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
        initial: suggestedSlug,
        required: true,
      },
      {
        type: 'input',
        name: 'guidelines',
        message: 'guidelines (link, leave blank if none)',
      },
      {
        type: 'select',
        name: 'precision',
        message:
          'pick precision for svgo (keep it at 3 unless there is a loss of quality)',
        required: true,
        choices: ['3', '4', '5'],
      },
    ])

    console.log(chalk.bold.cyan('Running svgo...'))

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

    const jsonDataPath = join('_data', 'simple-icons.json')
    const iconsData: {
      title: string
      hex: string
      source: string
      slug?: string
      guidelines?: string
    }[] = JSON.parse(readFileSync(jsonDataPath, 'utf-8')).icons

    let dataSlug = slug === suggestedSlug ? undefined : slug

    const foundIconIndex = iconsData.findIndex(
      ({ title: iconTitle, slug: iconSlug }) =>
        title === iconTitle && iconSlug === dataSlug
    )
    const foundIcon = iconsData[foundIconIndex]

    const newIconData = {
      title,
      hex,
      source,
      slug: dataSlug,
      guidelines: guidelines === '' ? undefined : guidelines,
    }

    // option to overwrite if an icon already exists
    if (foundIcon) {
      const { shouldOverwrite }: { shouldOverwrite: boolean } = await prompt({
        type: 'confirm',
        name: 'shouldOverwrite',
        message: `Found two icons with the title ${title} and slug ${dataSlug}. Would you like to overwrite with the newer icon data?`,
        required: true,
      })

      console.log(shouldOverwrite)

      if (shouldOverwrite)
        // overwrite merges objects, but replaces with the new icon data
        iconsData[foundIconIndex] = {
          ...foundIcon,
          ...newIconData,
        }
      else {
        const error = new Error(
          'There cannot be two icons with the same title and slug.'
        )
        error.name = 'Conflict'
        error.stack = undefined

        throw error
      }

      // if icon does not already exist, push the new icon
    } else iconsData.push(newIconData)

    iconsData.sort((prev, curr) => {
      const titleComparison = prev.title.localeCompare(curr.title)

      if (titleComparison === 0 && prev.slug && curr.slug)
        return prev.slug.localeCompare(curr.slug)

      return titleComparison
    })

    // combine JSON.stringify with newline for end of file
    const serializedIconsData = `${JSON.stringify(
      { icons: iconsData },
      null,
      4
    )}\n`

    writeFileSync(jsonDataPath, serializedIconsData, 'utf-8')

    // write file before lint (svglint needs to point at a file)
    const iconSvgFilename = `${slug}.svg`
    const iconSvgFilePath = join('icons', iconSvgFilename)
    writeFileSync(iconSvgFilePath, iconXml, 'utf-8')

    // lint
    console.log(chalk.bold.cyan('Running svglint...'))

    let execaValue: ExecaReturnValue<string>

    let exitCode = 0

    try {
      const insideProc = execa('node_modules/.bin/svglint', [
        iconSvgFilePath,
        '--ci',
      ])

      insideProc.stdout?.pipe(process.stdout)

      execaValue = await insideProc
    } catch (e) {}

    // @ts-expect-error execa only throws an error after execution
    // so `execaValue` will have a value
    if (execaValue?.exitCode !== 0) {
      const svglintCommand = chalk.bold(`npx svglint ${iconSvgFilePath} --ci`)

      console.log(
        chalk.red(
          `Make sure to fix these errors before creating a PR. Re-run svglint with ${svglintCommand}.`
        )
      )

      // @ts-expect-error
      exitCode = execaValue?.exitCode ?? 1
    } else console.log(chalk.green(`Successfully created ${title} icon.`))

    const sourceIndex = serializedIconsData.indexOf(`"title": "${title}"`)

    const lineCount = serializedIconsData
      .slice(0, sourceIndex)
      .split('\n').length

    const lineLink = `${jsonDataPath}:${lineCount}`

    console.log(chalk.blue(`Edit JSON data at ${lineLink}`))

    return exitCode
  }
}

export default RootCommand
