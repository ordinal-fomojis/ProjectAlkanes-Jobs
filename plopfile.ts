import { config, set } from '@dotenvx/dotenvx'
import { readdirSync, readFileSync } from 'fs'
import { Answers } from 'inquirer'
import { NodePlopAPI } from 'plop'
import z from 'zod'

const environments = readdirSync('env').map(file => file.replace('.env.', '')).filter(x => x !== 'keys')

export default function (plop: NodePlopAPI) {
  plop.setGenerator('set-env-variable', {
    description: 'Set a new, or updates and existing environment variable',
    prompts: [
      {
        type: 'confirm',
        name: 'secret',
        message: 'is it a secret?'
      },
      {
        type: 'input',
        name: 'name',
        message: answers => answers.secret === true ? 'secret name' : 'environment variable name'
      },
      ...environments.map(env => [
        {
          type: 'password',
          name: `${env}_value`,
          message: `secret value for ${env}`,
          when: (answers: Answers) => answers.secret === true
        },
        {
          type: 'input',
          name: `${env}_value`,
          message: `environment variable value for ${env}`,
          when: (answers: Answers) => answers.secret === false
        }
      ]).flat()
    ],
    actions: [
      function customAction(answers) {
        const schema = z.object({
          name: z.string(),
          secret: z.boolean()
        })
        const { name, secret } = schema.parse(answers)
        const formattedName = name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')
        for (const env of environments) {
          set(formattedName, answers[`${env}_value`] as string, { path: `env/.env.${env}`, encrypt: secret })
        }
        return 'Set environment variable'
      }
    ]
  })

  plop.setGenerator('decrypt-env', {
    prompts: [
      {
        type: 'list',
        name: 'environment',
        message: 'Which environment do you want to decrypt?',
        choices: environments
      }
    ],
    actions: [
      function customAction(answers) {
        const { parsed } = config({ path: `env/.env.${answers.environment}`, quiet: true })

        if (parsed == null) {
          throw new Error(`Failed to parse .env.${answers.environment}`)
        }

        let file = readFileSync(`env/.env.${answers.environment}`, 'utf-8')
        for (const [key, value] of Object.entries(parsed)) {
          file = file.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}="${value}"`)
        }
        
        console.log('\n\n\n')
        console.log(file)
        console.log('\n')
        return 'Decrypted environment variables'
      }
    ]
  })
}
