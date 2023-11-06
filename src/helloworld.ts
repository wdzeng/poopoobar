import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)

export default function helloworld() {
  console.log('%s: hello world', filename)
}
