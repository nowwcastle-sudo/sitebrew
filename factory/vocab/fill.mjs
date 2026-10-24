// 글 틀의 {이름} 자리를 값으로 채운다. 사전 틀(expand.mjs)과 되묻는 글(grammar.yaml 의 text)이 함께 쓴다. 틀에 없는 이름은 그대로 두지 않고 던진다.
export const fill = (template, vars) => template.replace(/\{(\w+)\}/g, (_, name) => {
  if (!(name in vars)) throw new Error(`틀 「${template}」의 {${name}} 자리에 넣을 값이 없다`)
  return vars[name]
})
