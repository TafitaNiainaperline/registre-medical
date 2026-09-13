import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '../../utils/error'

type LoginForm = {
  username: string
  name: string
  password: string
  confirm: string
}

const emptyForm: LoginForm = { username: '', name: '', password: '', confirm: '' }

// Les erreurs IPC arrivent préfixées par Electron : on ne garde que le message métier
const cleanError = (raw: string): string => {
  const remote = raw.match(/Error invoking remote method '[^']+':\s*Error:\s*(.*)$/i)
  const wrapped = raw.match(/Error:\s*(.*)$/i)
  return (remote?.[1] || wrapped?.[1] || raw).trim()
}

export const useLoginPage = () => {
  const navigate = useNavigate()
  const [isRegister, setIsRegister] = useState(false)
  const [form, setForm] = useState<LoginForm>(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const change = (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      if (isRegister) {
        if (form.password !== form.confirm) {
          setError('Les mots de passe ne correspondent pas.')
          return
        }
        await window.api.register({ username: form.username, name: form.name, password: form.password })
        setSuccess('Compte créé ! Attendez que l\'administrateur active votre compte.')
        setIsRegister(false)
        setForm(emptyForm)
        return
      }

      const user = await window.api.login({ username: form.username, password: form.password })
      localStorage.setItem('user', JSON.stringify(user))
      navigate('/')
    } catch (err) {
      const message = cleanError(errorMessage(err, 'Erreur d\'authentification'))
      setError(message || 'Erreur d\'authentification')
    }
  }

  const toggleMode = () => {
    setIsRegister(!isRegister)
    setError('')
    setSuccess('')
  }

  return {
    isRegister, form, error, success, showPwd, showConfirm,
    change, submit, toggleMode,
    toggleShowPwd: () => setShowPwd(!showPwd),
    toggleShowConfirm: () => setShowConfirm(!showConfirm),
  }
}
