import { applyTransform, type TransformSpec } from "./transform"

type AnyObject = Record<string, any>

/**
 * Resolve nested paths like:
 * user.name
 * users[0].name
 * cart.items[2].price
 */
const getValue = (data: AnyObject, path: string): any => {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")

  return parts.reduce((obj, key) => obj?.[key], data)
}

/**
 * Simple value formatters
 */
const formatValue = (value: any, formatter?: string) => {
  if (!formatter) return value

  switch (formatter.trim()) {
    case "currency":
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
      }).format(Number(value))

    case "date":
      return new Date(value).toLocaleDateString()

    case "time":
      return new Date(value).toLocaleTimeString()

    default:
      return value
  }
}

/**
 * Resolve a variable expression
 * Examples:
 * $price
 * $user.name
 * $price | currency
 */
const resolveVariable = (expr: string, data: AnyObject) => {
  const [path, formatter] = expr.split("|")

  const value = getValue(data, path.trim())

  if (value === undefined) return "N/A"

  return formatValue(value, formatter)
}

/**
 * Main recursive mapper
 */
export const mapDataToUI = (ui: any, data: AnyObject): any => {
  // handle string variables
  if (typeof ui === "string") {
    // exact variable
    const exact = ui.match(/^\$([a-zA-Z0-9_.[\]]+(?:\s*\|\s*\w+)?)$/)

    if (exact) {
      return resolveVariable(exact[1], data)
    }

    // replace variables inside string
    return ui.replace(/\$([a-zA-Z0-9_.[\]]+(?:\s*\|\s*\w+)?)/g, (_, expr) => {
      const value = resolveVariable(expr, data)
      return typeof value === "string" ? value : String(value)
    })
  }

  // handle arrays
  if (Array.isArray(ui)) {
    return ui.map(item => mapDataToUI(item, data))
  }

  // handle objects
  if (ui !== null && typeof ui === "object") {
    // $transform directive: { "$transform": { from: "$path", type: "...", ... } }
    if ("$transform" in ui) {
      const spec = ui.$transform
      if (spec && typeof spec === "object" && typeof spec.from === "string") {
        const sourcePath = (spec.from as string).replace(/^\$/, "")
        const source = getValue(data, sourcePath)
        const { from: _from, ...transformSpec } = spec
        return applyTransform(source, transformSpec as TransformSpec)
      }
      return null
    }

    // LOOP HANDLING
    if (ui.forEach && ui.item && ui.component) {

      const list = getValue(data, ui.forEach.replace("$", ""))

      if (!Array.isArray(list)) return []

      return list.map((value, index) => {

        const loopData = {
          ...data,
          [ui.item]: value,
          index
        }

        return mapDataToUI(ui.component, loopData)
      })
    }

    const result: AnyObject = {}

    for (const key in ui) {
      result[key] = mapDataToUI(ui[key], data)
    }

    return result
  }

  return ui
}

/**
 * Parse AI response
 */
export const parseUI = (input: any) => {
  if (!input) return null

  try {
    const parsed = JSON.parse(input)

    const { ui, data } = parsed

    // POST case (schema only)
    if (ui && !data) {
      return ui
    }

    // GET case (schema + data)
    if (ui && data) {
      return mapDataToUI(ui, data)
    }

    return null
  } catch {
    return null
  }
}