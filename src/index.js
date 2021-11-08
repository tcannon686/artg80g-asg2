import * as P5 from 'p5'

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

  const allMouseEvents = ['mousepress', 'mouserelease', 'mousemove']
  const titlebarTextColor = '#ffffff'
  const titlebarColor = '#000082'
  const windowColor = '#c3c3c3'
  const bgColor = '#008282'

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
          background,
          0,
          0,
          right - left,
          bottom - top
        )
      } else if (borderStyle === 'inset') {
        drawInset(
          background,
          0,
          0,
          right - left,
          bottom - top
        )
      } else {
        s.noStroke()
        s.fill(background)
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
    textStyle,
    ...rest
  }) => {
    const container = makeContainer({ left, top, ...rest })
    const draw = container.draw
    container.draw = () => {
      draw()
      s.textStyle(textStyle || s.NORMAL)
      s.fill(color)
      s.text(
        text,
        (marginLeft || 0) + (left || 0),
        (top || 0) + container.getHeight() - 2 + (marginTop || 0)
      )
    }
    return container
  }

  const makeWindow = ({ title, ...rest }) => {
    const container = makeContainer({
      background: windowColor,
      borderStyle: 'bevel',
      ...rest
    })
    const contents = makeContainer({ background: windowColor, ...rest })
    contents.layout = makeMarginLayout(contents, {
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
    container.contents = contents
    container.add(contents)
    container.add(titlebar)
    return container
  }

  const makeButton = ({ ...rest }) => {
    const container = makeText({
      background: windowColor,
      color: '#000',
      borderStyle: 'bevel',
      textStyle: s.BOLD,
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
      marginLeft: 4,
      marginTop: -5,
      text: 'Start'
    })
    container.add(button)
    return container
  }

  const root = makeContainer({
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    background: bgColor
  })

  const wnd = makeWindow({
    top: 10,
    left: 10,
    bottom: 500,
    right: 500,
    title: 'Minesweeper'
  })

  const wnd2 = makeWindow({
    top: 30,
    left: 50,
    bottom: 400,
    right: 300,
    title: 'test'
  })

  root.add(makeTaskbar())
  root.add(wnd)
  root.add(wnd2)

  s.draw = () => {
    root.draw()
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
