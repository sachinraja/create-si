const validateUrl = (url: string) =>
  /**
   * @see https://ihateregex.io/expr/url/
   */
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()!@:%_\+.~#?&\/\/=]*)/g.test(
    url
  )
    ? true
    : 'not a valid link'

export default validateUrl
