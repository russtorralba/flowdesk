import { useEffect, useRef } from 'react'

const dialogStack = []
const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const getFocusableElements = (dialog) => [...dialog.querySelectorAll(focusableSelector)]
  .filter((element) => !element.hasAttribute('hidden') && element.getClientRects().length > 0)

export function useDialogFocus(dialogRef, { active = true, initialFocusRef } = {}) {
  const openerRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!active || !dialog) return undefined

    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogStack.push(dialog)

    const focusInitialElement = () => {
      if (dialogStack.at(-1) !== dialog) return
      const initialElement = initialFocusRef?.current
      const focusTarget = initialElement && !initialElement.disabled ? initialElement : getFocusableElements(dialog)[0] || dialog
      focusTarget.focus()
    }

    const animationFrame = window.requestAnimationFrame(focusInitialElement)
    const trapFocus = (event) => {
      if (event.key !== 'Tab' || dialogStack.at(-1) !== dialog) return

      const focusableElements = getFocusableElements(dialog)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === firstElement)) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', trapFocus)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.removeEventListener('keydown', trapFocus)
      const stackIndex = dialogStack.lastIndexOf(dialog)
      if (stackIndex !== -1) dialogStack.splice(stackIndex, 1)

      const opener = openerRef.current
      if (opener && document.contains(opener)) window.requestAnimationFrame(() => opener.focus())
    }
  }, [active, dialogRef, initialFocusRef])
}
