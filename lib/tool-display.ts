import type { Tool } from "@/lib/types";

export function toolParamCount(tool: Tool): number {
  const properties = tool.parameter_schema?.properties;
  return properties && typeof properties === "object" && !Array.isArray(properties)
    ? Object.keys(properties).length
    : 0;
}

/** Icon + one-line badge text per tool type, shared by the agent's Tools tab
 * (sections.tsx's AgentToolsPanel) and the global library (tools/tools-library-panel.tsx). */
export function toolTypeMeta(tool: Tool): { icon: string; badge: string } {
  switch (tool.tool_type) {
    case "transfer_call":
      return { icon: "↪", badge: tool.destination_number ?? "transfer call" };
    case "record_lead_info":
      return { icon: "◔", badge: "record lead info" };
    case "record_callback_number":
      return { icon: "☏", badge: "record callback number" };
    case "detect_bot_call":
    case "detect_sales_call": {
      const count = tool.detector_statements?.length ?? 0;
      const kind = tool.tool_type === "detect_bot_call" ? "bot" : "sales";
      return {
        icon: "⦻",
        badge: `detect ${kind} · ${count} statement${count === 1 ? "" : "s"}`,
      };
    }
    case "function":
    default: {
      const count = toolParamCount(tool);
      return { icon: "ƒ", badge: `function · ${count} param${count === 1 ? "" : "s"}` };
    }
  }
}
