import type { ServiceError } from "@/services/result";

export function inventoryErrorMessage(error: ServiceError): string {
  switch (error.code) {
    case "conflict": return "This FrostPantry item changed somewhere else. Reload before saving again.";
    case "unauthorized": return "Please sign in again. Your changes are still here in this tab.";
    case "not_found": return "This FrostPantry item is no longer available.";
    case "validation_error": return "Check the item name, quantity, dates, and storage location before saving.";
    default: return "Something went wrong. Please try again. Your changes are still here.";
  }
}
