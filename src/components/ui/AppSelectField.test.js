import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import * as vue from 'vue'

function setup(props) {
  const { descriptor } = parse(readFileSync(new URL('./AppSelectField.vue', import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: 'select-default-test' }).content
  const component = new Function(...Object.keys(vue), script.replace(/^import .*$/gm, '').replace('export default', 'return'))(...Object.values(vue))
  const events = []
  const form = component.setup(props, { expose() {}, emit: (...args) => events.push(args) })
  return { form, events }
}

test('空选项每次展开刷新默认选中，取消保持原值', () => {
  let current = '10:20'
  const props = vue.reactive({ modelValue: '', options: [], label: '开始时间', defaultValue: () => current })
  const { form, events } = setup(props)
  form.open()
  assert.deepEqual(form.pickerValue.value, ['10:20'])
  form.show.value = false
  assert.equal(props.modelValue, '')
  assert.deepEqual(events, [])
  current = '10:22'
  form.open()
  assert.deepEqual(form.pickerValue.value, ['10:22'])
  form.confirm({ selectedValues: ['10:22'] })
  assert.deepEqual(events, [['update:modelValue', '10:22']])
})

test('已有选中值及数字零优先回显', () => {
  for (const value of ['13:00', 0]) {
    const { form } = setup(vue.reactive({ modelValue: value, options: [], label: '选项', defaultValue: () => { throw new Error('不应覆盖已有值') } }))
    form.open()
    assert.deepEqual(form.pickerValue.value, [value])
  }
})
