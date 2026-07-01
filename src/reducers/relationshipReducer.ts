import type { Relationship, RelationshipAction } from '../types';

export function relationshipReducer(
  relationships: Relationship[],
  action: RelationshipAction
): Relationship[] {
  switch (action.type) {
    case 'ADD_RELATIONSHIP':
      return [...relationships, action.payload];

    case 'UPDATE_RELATIONSHIP':
      return relationships.map((relationship) =>
        relationship.id === action.payload.id ? action.payload : relationship
      );

    case 'DELETE_RELATIONSHIP':
      return relationships.filter(
        (relationship) => relationship.id !== action.payload.id
      );

    default:
      return relationships;
  }
}
