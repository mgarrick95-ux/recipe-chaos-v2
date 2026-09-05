import type { ServiceError } from '../../../services/result.ts';

export function recipeErrorMessage(error: ServiceError): string {
  switch (error.code) {
    case 'conflict': return 'This recipe changed somewhere else. Reload before saving again.';
    case 'unauthorized': return 'Please sign in again. Your changes are still here in this tab.';
    case 'not_found': return 'This recipe is no longer available.';
    case 'validation_error': return 'Check the title, ingredient lines, steps, source URL, and servings before saving.';
    default: return 'Something went wrong. Please try again. Your changes are still here.';
  }
}
