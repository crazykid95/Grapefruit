import { performOnMainThread } from '../lib/dispatch'
import {
  UIGraphicsBeginImageContextWithOptions,
  UIGraphicsGetImageFromCurrentImageContext,
  UIGraphicsEndImageContext,
  UIImagePNGRepresentation
} from '../lib/UIKit'

const { UIWindow, UIView, UIColor } = ObjC.classes

type Point = [number, number];
type Size = [number, number];
type Frame = [Point, Size];

interface Node {
  description?: string;
  children?: Node[];
  frame?: Frame;
  delegate?: string;
  preview?: ArrayBuffer;
}

export function dump(includingPreview: false): Promise<Node> {
  const win = UIWindow.keyWindow()
  const recursive = (view: ObjC.Object): Node => {
    if (!view) return {}

    const description = view.description().toString()
    const subviews = view.subviews()
    const delegate = typeof view.delegate === 'function' ? view.delegate()?.toString() : ''
    const frame = view.superview()?.convertRect_toView_(view.frame(), NULL) as Frame
    const children: Node[] = []

    if (includingPreview) {
      // preview
      const bounds = view.bounds()
      const size = bounds[1]
      UIGraphicsBeginImageContextWithOptions(size, 0, 0)
      const image = UIGraphicsGetImageFromCurrentImageContext();
      UIGraphicsEndImageContext()
      const png = UIImagePNGRepresentation(image) as NativePointer
      let preview = undefined
      if (!png.isNull()) {
        const data = new ObjC.Object(png)
        preview = data.base64EncodedStringWithOptions_(0).toString()
      }
    }

    for (let i = 0; i < subviews.count(); i++) {
      // todo: use async function
      children.push(recursive(subviews.objectAtIndex_(i)))
    }
    return {
      description,
      children,
      frame,
      delegate,
      preview
    }
  }

  return performOnMainThread(() => recursive(win))
}

let overlay: ObjC.Object

// NSMakePoint
// NSMakeSize
export function highlight(frame: Frame): void {
  if (!frame) return

  const win = UIWindow.keyWindow()
  if (!win) return

  ObjC.schedule(ObjC.mainQueue, () => {
    if (!overlay) {
      overlay = UIView.alloc().initWithFrame_(frame)
      overlay.setBackgroundColor_(UIColor.yellowColor())
      overlay.setAlpha_(0.4)
    } else {
      overlay.removeFromSuperview()
      overlay.setFrame_(frame)
    }
    win.addSubview_(overlay)
  })
}

export async function dismissHighlight(): Promise<void> {
  if (!overlay) return
  await performOnMainThread(() => overlay.removeFromSuperview())
}

// highlight([[0,0],[375,812]])
// setTimeout(() => { dismissHighlight() }, 3000)
// setTimeout(() => { highlight([[100,100],[375,812]]) }, 1000)

export function dispose() {
  return dismissHighlight()
}