import { sessionState, signIn } from './session.js'

const form = document.getElementById('form')
const error = document.getElementById('error')
const submit = document.getElementById('submit')

const showError = message => {
  error.textContent = message
  error.hidden = !message
}

if ((await sessionState()) !== 'signed-out') location.replace('/')

form.addEventListener('input', () => showError(''))
form.addEventListener('submit', async event => {
  event.preventDefault()
  const email = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value
  if (!email || !password) return showError('Isi email dan password.')
  submit.disabled = true
  submit.textContent = 'Masuk…'
  try {
    await signIn(email, password)
    location.replace('/')
  } catch (failure) {
    showError(failure.message)
    submit.disabled = false
    submit.textContent = 'Masuk'
  }
})
