import * as P5 from 'p5'
import SfxThwunk from './assets/thwunk.mp3'
import SfxMinesweeper from './assets/minesweeper.mp3'

const { min, max, floor, random, ceil } = Math

const makeEventEmitter = () => {
  const map = new Map()
  return {
    on (name, listener) {
      const callbacks = map.get(name) || new Set()
      map.set(name, callbacks)
      callbacks.add(listener)
    },
    off (name, listener) {
      const callbacks = map.get(name) || new Set()
      map.set(name, callbacks)
      callbacks.remove(listener)
    },
    emit (name, ...args) {
      (map.get(name) || new Set()).forEach(listener => {
        listener(...args)
      })
    }
  }
}

/* eslint-disable-next-line no-new */
new P5(s => {
  s.setup = () => {
    s.createCanvas(800, 600)
  }

  const animationLength = 50
  const allMouseEvents = ['mousepress', 'mouserelease', 'mousemove']
  const titlebarTextColor = '#da3e52'
  const titlebarColor = '#393d3f'
  const windowColor = '#9cc4b2'
  const bgColor = '#5688c7'
  const textColor = '#393d3f'
  let time = 0

  let sfxThwunk
  let sfxMinesweeper

  const makeSfx = (src) => {
    const sfxs = Array(25).fill(null).map(x => s.createAudio(src))
    let index = 0
    return {
      play () {
        sfxs[index].play()
        index++
        index %= sfxs.length
      }
    }
  }

  s.preload = () => {
    sfxThwunk = makeSfx(SfxThwunk)
    sfxMinesweeper = s.createAudio(SfxMinesweeper)
  }

  const drawInset = (background, x, y, w, h) => {
    s.noStroke()

    /* Draw shadowed. */
    s.fill(0x00, 0x7F)
    s.rect(x, y, w - 1, h - 1)

    /* Draw shiny. */
    s.fill(0xFF)
    s.rect(x + 1, y + 1, w - 1, h - 1)

    /* Draw regular part of window. */
    s.fill(background)
    s.rect(x + 1, y + 1, w - 2, h - 2)
  }

  const drawBevel = (background, x, y, w, h) => {
    s.noStroke()

    /* Draw shadow. */
    s.fill(0x00)
    s.rect(x, y, w, h)

    s.fill(background)
    s.rect(x, y, w - 1, h - 1)

    /* Draw shiny top of window. */
    s.fill(0xFF)
    s.rect(x + 1, y + 1, w - 2, h - 2)

    /* Draw shaded bottom of window. */
    s.fill(0x00, 0x7F)
    s.rect(x + 2, y + 2, w - 3, h - 3)

    /* Draw regular part of window. */
    s.fill(background)
    s.rect(x + 2, y + 2, w - 4, h - 4)
  }

  const parents = new WeakMap()
  const makeContainer = ({
    left,
    top,
    bottom,
    right,
    background,
    borderStyle
  }) => {
    const emitter = makeEventEmitter()
    const children = new Set()
    let isDirty = false

    const propagateMouseEvent = (name) => {
      emitter.on(name, ({ x, y, ...rest }) => {
        const candidates = Array.from(children.values())
          .filter(child => child.contains(x - left, y - top))
          .reverse()
        for (const child of candidates) {
          let stop = false
          const stopPropagation = () => {
            stop = true
          }
          child.emit(name, {
            x: x - left,
            y: y - top,
            stopPropagation
          })
          if (stop) {
            break
          }
        }
      })
    }
    allMouseEvents.forEach(name => propagateMouseEvent(name))

    const draw = () => {
      if (isDirty) {
        layout()
        children.forEach(child => child.layout())
      }
      s.push()
      s.translate(left, top)
      if (borderStyle === 'bevel') {
        drawBevel(
          background || windowColor,
          0,
          0,
          right - left,
          bottom - top
        )
      } else if (borderStyle === 'inset') {
        drawInset(
          background || windowColor,
          0,
          0,
          right - left,
          bottom - top
        )
      } else {
        s.noStroke()
        s.fill(background || windowColor)
        s.rect(0, 0, right - left, bottom - top)
      }
      children.forEach(child => child.draw())
      s.pop()
    }

    const add = (child) => {
      children.add(child)
      parents.set(child, ret)
      child.layout()
    }

    const remove = (child) => {
      children.delete(child)
      parents.set(child, null)
      child.layout()
    }

    const layout = () => {
      isDirty = false
    }

    const setTop = (v) => {
      isDirty = true
      top = v
    }

    const setBottom = (v) => {
      isDirty = true
      bottom = v
    }

    const setLeft = (v) => {
      isDirty = true
      left = v
    }

    const setRight = (v) => {
      isDirty = true
      right = v
    }

    const setBorderStyle = (v) => {
      borderStyle = v
    }

    const contains = (x, y) => (
      x >= left && y >= top && x <= right && y <= bottom
    )

    const ret = {
      ...emitter,
      draw,
      add,
      remove,
      layout,
      setTop,
      setBottom,
      setLeft,
      setRight,
      setBorderStyle,
      contains,
      getBounds () { return { top, left, right, bottom } },
      getWidth () { return right - left },
      getHeight () { return bottom - top },
      getLeft () { return left },
      getTop () { return top },
      getBottom () { return bottom },
      getRight () { return right },
      getParent () { return parents.get(ret) },
      getBorderStyle () { return borderStyle }
    }

    return ret
  }

  const makeMarginLayout = (container, {
    left,
    right,
    top,
    bottom,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom
  }) => {
    const oldLayout = container.layout
    return () => {
      oldLayout()
      container.setLeft((left || 0) + (marginLeft || 0))
      container.setTop((top || 0) + (marginTop || 0))
      container.setRight((right || container.getParent().getWidth()) - (marginRight || 0))
      container.setBottom((bottom || container.getParent().getHeight()) - (marginBottom || 0))
    }
  }

  const makeText = ({
    text,
    color,
    left,
    top,
    marginLeft,
    marginTop,
    marginRight,
    textStyle,
    textAlign,
    ...rest
  }) => {
    textAlign = textAlign || s.LEFT
    const container = makeContainer({ left, top, ...rest })
    const draw = container.draw
    const textX = {
      [s.LEFT]: () => (marginLeft || 0) + (container.getLeft() || 0),
      [s.RIGHT]: () => (container.getRight()) - (marginRight || 0),
      [s.CENTER]: () => (container.getLeft() + container.getRight()) / 2
    }
    container.draw = () => {
      draw()
      s.textFont('Helvetica')
      s.textStyle(textStyle || s.NORMAL)
      s.textAlign(textAlign || s.LEFT)
      s.fill(color || textColor)
      s.text(
        text,
        textX[textAlign](),
        (top || 0) + container.getHeight() - 2 + (marginTop || 0)
      )
    }
    return container
  }

  const makeShaker = (container) => {
    const draw = container.draw
    const offset = Math.random() * 1000
    return () => {
      const t = min(time / animationLength, 1.0)
      const shakeAmount = (t ** 10) * 0.75
      const centerX = (container.getLeft() + container.getRight()) / 2
      const centerY = (container.getTop() + container.getBottom()) / 2
      const shakeRot = Math.sin(time * 31 + offset) * shakeAmount / 5
      const shakeX = Math.sin(time * 33 + offset) * 5 * shakeAmount
      const shakeY = Math.cos(time * 37 + offset) * 5 * shakeAmount
      s.push()
      s.translate(centerX, centerY)
      s.rotate(shakeRot)
      s.translate(-centerX, -centerY)
      s.translate(shakeX, shakeY)
      draw()
      s.pop()
    }
  }

  const makeWindow = ({ title, ...rest }) => {
    const container = makeContainer({
      background: windowColor,
      borderStyle: 'bevel',
      ...rest
    })
    const content = makeContainer({ background: windowColor, ...rest })
    content.layout = makeMarginLayout(content, {
      marginLeft: 3,
      marginTop: 3 + 18,
      marginRight: 3,
      marginBottom: 3
    })
    const titlebar = makeText({
      background: titlebarColor,
      color: titlebarTextColor,
      text: title,
      marginLeft: 10
    })
    titlebar.layout = makeMarginLayout(titlebar, {
      marginLeft: 3,
      marginTop: 3,
      marginRight: 3,
      bottom: 3 + 18
    })

    let dragging = false
    titlebar.on('mousepress', () => {
      const p = container.getParent()
      p.remove(container)
      p.add(container)
      dragging = true
    })
    root.on('mousedrag', (e) => {
      if (dragging) {
        container.setLeft(container.getLeft() + e.movementX)
        container.setTop(container.getTop() + e.movementY)
        container.setRight(container.getRight() + e.movementX)
        container.setBottom(container.getBottom() + e.movementY)
      }
    })
    root.on('mouserelease', () => {
      dragging = false
    })

    /* Stop propagating mouse events. */
    allMouseEvents.forEach(name => {
      container.on(name, (e) => {
        e.stopPropagation()
      })
    })
    container.titlebar = titlebar
    container.content = content
    container.add(content)
    container.add(titlebar)
    container.draw = makeShaker(container)
    return container
  }

  const makeButton = ({ ...rest }) => {
    const container = makeText({
      background: windowColor,
      color: textColor,
      borderStyle: 'bevel',
      textStyle: s.BOLD,
      textAlign: s.CENTER,
      marginLeft: 4,
      marginTop: -5,
      ...rest
    })
    container.on('mousepress', () => {
      container.setBorderStyle('inset')
    })
    container.on('mouserelease', () => {
      container.setBorderStyle('bevel')
    })
    return container
  }

  const makeTaskbar = () => {
    const container = makeContainer({
      top: 0,
      left: 0,
      bottom: 29,
      right: 800,
      borderStyle: 'bevel',
      background: windowColor
    })
    container.layout = makeMarginLayout(container, {
      marginLeft: 0,
      marginRight: 0,
      marginBottom: 0,
      top: 600 - 29
    })

    const button = makeButton({
      left: 3,
      top: 3,
      bottom: 3 + 29 - 6,
      right: 64,
      text: 'Start'
    })
    container.add(button)
    return container
  }

  const makeDialog = ({
    top, left, bottom, right, text,
    onOkay,
    ...rest
  }) => {
    left = left || root.getWidth() / 2 - 128
    top = top || root.getHeight() / 2 - 64
    bottom = bottom || top + 128
    right = right || left + 256
    const w = makeWindow({ left, top, bottom, right, ...rest })
    const msg = makeText({
      left: 3,
      top: 3,
      right: 64,
      bottom: 23 + 3,
      text,
      textAlign: s.CENTER
    })
    msg.layout = makeMarginLayout(msg, {
      marginLeft: 3,
      marginRight: 3,
      marginTop: 3,
      marginBottom: 59
    })
    const okay = makeButton({
      left: w.content.getWidth() / 2 - 32,
      top: w.content.getHeight() - 23 - 3,
      right: w.content.getWidth() / 2 + 32,
      bottom: w.content.getHeight() - 3,
      text: 'Okay'
    })
    okay.on('mouserelease', () => {
      if (onOkay) {
        onOkay()
      }
      w.getParent().remove(w)
    })

    w.content.add(msg)
    w.content.add(okay)
    return w
  }

  const root = makeContainer({
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    background: bgColor
  })

  const errorMsgs = [
    'Uh oh! Something went went wrong.',
    'An error occurred.',
    'System error detected!',
    'Task failed.',
    'A system the problem the detected.',
    'An error has been occurred.',
    'Minesweeper is coming.',
    'Minesweeper is coming in 1990!',
    'Prepare yourself for MINESWEEPER',
    'Uh oh? Here comes the sweep!'
  ]
  let timeoutLength = 5000
  let dialogCount = 0
  const dialogLoop = () => {
    if (dialogCount < 60) {
      const dialog = makeDialog({
        title: 'System Error',
        text: errorMsgs[floor(random() * errorMsgs.length)],
        left: random() * (root.getWidth() - 256),
        top: random() * (root.getHeight() - 128)
      })
      root.add(dialog)
      sfxThwunk.play()
      timeoutLength *= 0.9
      timeoutLength = max(timeoutLength, 250)
      setTimeout(dialogLoop, timeoutLength)
      dialogCount++
    }
  }

  root.add(makeTaskbar())
  root.add(makeDialog({
    title: 'Welcome!',
    text: 'Psst! Boss is away...Minesweeper? ;-)',
    onOkay () {
      sfxMinesweeper.play()
      dialogLoop()
    }
  }))

  const textColors = ['#393d3f', '#9cc4b2', '#5688c7']
  const getColor = t => {
    const index = floor(t) % textColors.length
    const nextIndex = ceil(t) % textColors.length
    const color = s.color(textColors[index])
    const nextColor = s.color(textColors[nextIndex])
    const lerpT = (t - floor(t))
    return s.lerpColor(color, nextColor, lerpT)
  }
  s.draw = () => {
    if (time - animationLength < 3) {
      root.draw()
    }
    if (time >= animationLength) {
      s.push()
      s.noStroke()
      s.translate(0, min(0, (time - animationLength) * 200 - 600))

      s.fill('#393d3f')
      s.rect(0, 0, 800, 600)

      s.textAlign(s.CENTER)
      s.fill('#9cc4b2')
      s.textFont('Helvetica')
      s.textSize(24)
      s.text('Microsoft presents:', 800 / 2, 600 / 2 - 64)

      s.textStyle(s.NORMAL)
      s.textSize(72)
      s.textFont('Georgia')
      for (let i = 0; i < 128; i++) {
        const v = i * 1 / 128
        const t = (v + time / 4) * textColors.length
        s.fill(i === 127 ? '#9cc4b2' : getColor(t))
        s.textSize(32 + v * v * 48)
        s.text('MINESWEEPER', 800 / 2, 600 / 2 - 8 + v * 64)
      }

      s.fill('#9cc4b2')
      s.textStyle(s.NORMAL)
      s.textSize(24)
      s.textFont('Helvetica')
      s.text('Coming October 31st, 1990', 800 / 2, 600 / 2 + 128)
      s.pop()
    }
    if (dialogCount > 0) {
      time += s.deltaTime / 1000
    }
  }

  const makeMouseHandler = (name) =>
    ({ offsetX, offsetY, movementX, movementY }) => {
      root.emit(name, { x: offsetX, y: offsetY, movementX, movementY })
    }

  s.mousePressed = makeMouseHandler('mousepress')
  s.mouseReleased = makeMouseHandler('mouserelease')
  s.mouseDragged = makeMouseHandler('mousedrag')
  s.mouseMoved = makeMouseHandler('mousemove')
})
