
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "alerts": {
                  Row: {
                    "couple_id": string,"created_at": string,"id": string,"kind": string,"media_type": string,"services": NonNullable<Json>,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"id"?: string,"kind": string,"media_type": string,"services"?: NonNullable<Json>,"tmdb_id": number
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"media_type"?: string,"services"?: NonNullable<Json>,"tmdb_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "alerts_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "alerts_media_type_tmdb_id_fkey"
      columns: ["media_type","tmdb_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["media_type","tmdb_id"]
    }
                  ]
                },"availability": {
                  Row: {
                    "country": string,"display_priority": number,"kind": string,"logo_path": string | null,"media_type": string,"provider_id": number,"provider_name": string,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "country": string,"display_priority"?: number,"kind": string,"logo_path"?: string | null,"media_type": string,"provider_id": number,"provider_name": string,"tmdb_id": number
                  }
                  Update: {
                    "country"?: string,"display_priority"?: number,"kind"?: string,"logo_path"?: string | null,"media_type"?: string,"provider_id"?: number,"provider_name"?: string,"tmdb_id"?: number
                  }
                  Relationships: [
                    
                  ]
                },"availability_checks": {
                  Row: {
                    "checked_at": string,"country": string,"link": string | null,"media_type": string,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"country": string,"link"?: string | null,"media_type": string,"tmdb_id": number
                  }
                  Update: {
                    "checked_at"?: string,"country"?: string,"link"?: string | null,"media_type"?: string,"tmdb_id"?: number
                  }
                  Relationships: [
                    
                  ]
                },"availability_snapshots": {
                  Row: {
                    "country": string,"media_type": string,"provider_ids": (number)[],"recorded_at": string,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "country": string,"media_type": string,"provider_ids"?: (number)[],"recorded_at"?: string,"tmdb_id": number
                  }
                  Update: {
                    "country"?: string,"media_type"?: string,"provider_ids"?: (number)[],"recorded_at"?: string,"tmdb_id"?: number
                  }
                  Relationships: [
                    
                  ]
                },"couples": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"invite_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"invite_code": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"invite_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"list_items": {
                  Row: {
                    "added_by": string | null,"categories": (string)[],"couple_id": string,"created_at": string,"episode": number | null,"id": string,"media_type": string,"notes": string,"season": number | null,"status": string,"tmdb_id": number,"updated_at": string,"watched_on": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"categories"?: (string)[],"couple_id": string,"created_at"?: string,"episode"?: number | null,"id"?: string,"media_type": string,"notes"?: string,"season"?: number | null,"status"?: string,"tmdb_id": number,"updated_at"?: string,"watched_on"?: string | null
                  }
                  Update: {
                    "added_by"?: string | null,"categories"?: (string)[],"couple_id"?: string,"created_at"?: string,"episode"?: number | null,"id"?: string,"media_type"?: string,"notes"?: string,"season"?: number | null,"status"?: string,"tmdb_id"?: number,"updated_at"?: string,"watched_on"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "list_items_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "list_items_media_type_tmdb_id_fkey"
      columns: ["media_type","tmdb_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["media_type","tmdb_id"]
    }
                  ]
                },"list_ratings": {
                  Row: {
                    "couple_id": string,"created_at": string,"list_item_id": string,"profile_id": string,"rating": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"list_item_id": string,"profile_id": string,"rating": number,"updated_at"?: string
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"list_item_id"?: string,"profile_id"?: string,"rating"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "list_ratings_list_item_id_couple_id_fkey"
      columns: ["list_item_id","couple_id"]
isOneToOne: false
      referencedRelation: "list_items"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "list_ratings_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "alerts_seen_at": string,"country": string | null,"couple_id": string | null,"created_at": string,"display_name": string,"id": string,"language": string,"services": (number)[],"time_zone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alerts_seen_at"?: string,"country"?: string | null,"couple_id"?: string | null,"created_at"?: string,"display_name"?: string,"id": string,"language"?: string,"services"?: (number)[],"time_zone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "alerts_seen_at"?: string,"country"?: string | null,"couple_id"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"language"?: string,"services"?: (number)[],"time_zone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"p256dh": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"p256dh": string,"profile_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"reminders": {
                  Row: {
                    "couple_id": string,"created_at": string,"created_by": string | null,"id": string,"media_type": string,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"media_type": string,"tmdb_id": number
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"media_type"?: string,"tmdb_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "reminders_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reminders_media_type_tmdb_id_fkey"
      columns: ["media_type","tmdb_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["media_type","tmdb_id"]
    }
                  ]
                },"services": {
                  Row: {
                    "country": string,"display_priority": number,"logo_path": string | null,"name": string,"provider_id": number,"refreshed_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "country": string,"display_priority"?: number,"logo_path"?: string | null,"name": string,"provider_id": number,"refreshed_at"?: string
                  }
                  Update: {
                    "country"?: string,"display_priority"?: number,"logo_path"?: string | null,"name"?: string,"provider_id"?: number,"refreshed_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"signup_allowlist": {
                  Row: {
                    "email": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email": string
                  }
                  Update: {
                    "email"?: string
                  }
                  Relationships: [
                    
                  ]
                },"title_texts": {
                  Row: {
                    "genres": (string)[],"locale": string,"media_type": string,"overview": string,"refreshed_at": string,"tagline": string,"title": string,"tmdb_id": number,"trailer_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "genres"?: (string)[],"locale": string,"media_type": string,"overview"?: string,"refreshed_at"?: string,"tagline"?: string,"title": string,"tmdb_id": number,"trailer_key"?: string | null
                  }
                  Update: {
                    "genres"?: (string)[],"locale"?: string,"media_type"?: string,"overview"?: string,"refreshed_at"?: string,"tagline"?: string,"title"?: string,"tmdb_id"?: number,"trailer_key"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "title_texts_media_type_tmdb_id_fkey"
      columns: ["media_type","tmdb_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["media_type","tmdb_id"]
    }
                  ]
                },"titles": {
                  Row: {
                    "backdrop_path": string | null,"genre_ids": (number)[],"media_type": string,"original_language": string | null,"original_title": string,"poster_path": string | null,"refreshed_at": string,"release_date": string | null,"runtime": number | null,"seasons": number | null,"tmdb_id": number,"vote_average": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "backdrop_path"?: string | null,"genre_ids"?: (number)[],"media_type": string,"original_language"?: string | null,"original_title": string,"poster_path"?: string | null,"refreshed_at"?: string,"release_date"?: string | null,"runtime"?: number | null,"seasons"?: number | null,"tmdb_id": number,"vote_average"?: number | null
                  }
                  Update: {
                    "backdrop_path"?: string | null,"genre_ids"?: (number)[],"media_type"?: string,"original_language"?: string | null,"original_title"?: string,"poster_path"?: string | null,"refreshed_at"?: string,"release_date"?: string | null,"runtime"?: number | null,"seasons"?: number | null,"tmdb_id"?: number,"vote_average"?: number | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_couple":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"is_time_zone":
{ Args: { "tz": string }; Returns: boolean
                           },
"join_couple":
{ Args: { "code": string }; Returns: string
                           },
"my_couple_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"new_invite_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"request_daily_check":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"valid_categories":
{ Args: { "categories": (string)[] }; Returns: boolean
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
