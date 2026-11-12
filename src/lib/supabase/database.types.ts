
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
                },"calendar_feeds": {
                  Row: {
                    "created_at": string,"profile_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"profile_id": string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"profile_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_feeds_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"dismissed_titles": {
                  Row: {
                    "couple_id": string,"created_at": string,"dismissed_by": string | null,"media_type": string,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"dismissed_by"?: string | null,"media_type": string,"tmdb_id": number
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"dismissed_by"?: string | null,"media_type"?: string,"tmdb_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "dismissed_titles_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "dismissed_titles_dismissed_by_fkey"
      columns: ["dismissed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"list_reviews": {
                  Row: {
                    "body": string,"couple_id": string,"created_at": string,"list_item_id": string,"profile_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"couple_id": string,"created_at"?: string,"list_item_id": string,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"couple_id"?: string,"created_at"?: string,"list_item_id"?: string,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "list_reviews_list_item_id_couple_id_fkey"
      columns: ["list_item_id","couple_id"]
isOneToOne: false
      referencedRelation: "list_items"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "list_reviews_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"moods": {
                  Row: {
                    "couple_id": string,"mood": string,"on_day": string,"profile_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"mood": string,"on_day": string,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "couple_id"?: string,"mood"?: string,"on_day"?: string,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "moods_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moods_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"night_prep_items": {
                  Row: {
                    "added_by": string | null,"couple_id": string,"created_at": string,"done_at": string | null,"done_by": string | null,"id": string,"label": string,"watch_night_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"couple_id": string,"created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"label": string,"watch_night_id": string
                  }
                  Update: {
                    "added_by"?: string | null,"couple_id"?: string,"created_at"?: string,"done_at"?: string | null,"done_by"?: string | null,"id"?: string,"label"?: string,"watch_night_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "night_prep_items_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "night_prep_items_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "night_prep_items_watch_night_id_couple_id_fkey"
      columns: ["watch_night_id","couple_id"]
isOneToOne: false
      referencedRelation: "watch_nights"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"night_proposals": {
                  Row: {
                    "answered_at": string | null,"answered_by": string | null,"couple_id": string,"created_at": string,"id": string,"link": string | null,"media_type": string | null,"method": string | null,"notes": string,"picked": number | null,"proposed_by": string,"status": string,"syncplay_room": string | null,"syncplay_server": string | null,"times": (string)[],"tmdb_id": number | null,"watch_night_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"couple_id": string,"created_at"?: string,"id"?: string,"link"?: string | null,"media_type"?: string | null,"method"?: string | null,"notes"?: string,"picked"?: number | null,"proposed_by": string,"status"?: string,"syncplay_room"?: string | null,"syncplay_server"?: string | null,"times": (string)[],"tmdb_id"?: number | null,"watch_night_id"?: string | null
                  }
                  Update: {
                    "answered_at"?: string | null,"answered_by"?: string | null,"couple_id"?: string,"created_at"?: string,"id"?: string,"link"?: string | null,"media_type"?: string | null,"method"?: string | null,"notes"?: string,"picked"?: number | null,"proposed_by"?: string,"status"?: string,"syncplay_room"?: string | null,"syncplay_server"?: string | null,"times"?: (string)[],"tmdb_id"?: number | null,"watch_night_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "night_proposals_answered_by_fkey"
      columns: ["answered_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "night_proposals_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "night_proposals_media_type_tmdb_id_fkey"
      columns: ["media_type","tmdb_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["media_type","tmdb_id"]
    },{
      foreignKeyName: "night_proposals_proposed_by_fkey"
      columns: ["proposed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "night_proposals_watch_night_id_fkey"
      columns: ["watch_night_id"]
isOneToOne: false
      referencedRelation: "watch_nights"
      referencedColumns: ["id"]
    }
                  ]
                },"night_reminders": {
                  Row: {
                    "kind": string,"sent_at": string,"starts_at": string,"watch_night_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"sent_at"?: string,"starts_at": string,"watch_night_id": string
                  }
                  Update: {
                    "kind"?: string,"sent_at"?: string,"starts_at"?: string,"watch_night_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "night_reminders_watch_night_id_fkey"
      columns: ["watch_night_id"]
isOneToOne: false
      referencedRelation: "watch_nights"
      referencedColumns: ["id"]
    }
                  ]
                },"night_wrapups": {
                  Row: {
                    "couple_id": string,"done_at": string,"outcome": string,"profile_id": string,"watch_night_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"done_at"?: string,"outcome": string,"profile_id": string,"watch_night_id": string
                  }
                  Update: {
                    "couple_id"?: string,"done_at"?: string,"outcome"?: string,"profile_id"?: string,"watch_night_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "night_wrapups_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "night_wrapups_watch_night_id_couple_id_fkey"
      columns: ["watch_night_id","couple_id"]
isOneToOne: false
      referencedRelation: "watch_nights"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "alerts_seen_at": string,"country": string | null,"couple_id": string | null,"created_at": string,"display_name": string,"id": string,"language": string,"services": (number)[],"time_zone": string,"updated_at": string,"visiting_country": string | null,"visiting_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alerts_seen_at"?: string,"country"?: string | null,"couple_id"?: string | null,"created_at"?: string,"display_name"?: string,"id": string,"language"?: string,"services"?: (number)[],"time_zone"?: string,"updated_at"?: string,"visiting_country"?: string | null,"visiting_until"?: string | null
                  }
                  Update: {
                    "alerts_seen_at"?: string,"country"?: string | null,"couple_id"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"language"?: string,"services"?: (number)[],"time_zone"?: string,"updated_at"?: string,"visiting_country"?: string | null,"visiting_until"?: string | null
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
                },"rating_guesses": {
                  Row: {
                    "actual": number,"couple_id": string,"created_at": string,"guess": number | null,"list_item_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actual": number,"couple_id": string,"created_at"?: string,"guess"?: number | null,"list_item_id": string,"profile_id": string
                  }
                  Update: {
                    "actual"?: number,"couple_id"?: string,"created_at"?: string,"guess"?: number | null,"list_item_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rating_guesses_list_item_id_couple_id_fkey"
      columns: ["list_item_id","couple_id"]
isOneToOne: false
      referencedRelation: "list_items"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "rating_guesses_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"ready_checks": {
                  Row: {
                    "couple_id": string,"created_at": string,"file_label": string,"file_seconds": number | null,"profile_id": string,"ready_at": string | null,"updated_at": string,"watch_night_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"file_label"?: string,"file_seconds"?: number | null,"profile_id": string,"ready_at"?: string | null,"updated_at"?: string,"watch_night_id": string
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"file_label"?: string,"file_seconds"?: number | null,"profile_id"?: string,"ready_at"?: string | null,"updated_at"?: string,"watch_night_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ready_checks_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ready_checks_watch_night_id_couple_id_fkey"
      columns: ["watch_night_id","couple_id"]
isOneToOne: false
      referencedRelation: "watch_nights"
      referencedColumns: ["id","couple_id"]
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
                },"review_signals": {
                  Row: {
                    "changed_at": string,"couple_id": string,"list_item_id": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_at"?: string,"couple_id": string,"list_item_id": string,"profile_id": string
                  }
                  Update: {
                    "changed_at"?: string,"couple_id"?: string,"list_item_id"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "review_signals_list_item_id_couple_id_fkey"
      columns: ["list_item_id","couple_id"]
isOneToOne: false
      referencedRelation: "list_items"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "review_signals_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rewatch_ratings": {
                  Row: {
                    "couple_id": string,"created_at": string,"profile_id": string,"rating": number,"rewatch_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"profile_id": string,"rating": number,"rewatch_id": string,"updated_at"?: string
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"profile_id"?: string,"rating"?: number,"rewatch_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rewatch_ratings_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rewatch_ratings_rewatch_id_couple_id_fkey"
      columns: ["rewatch_id","couple_id"]
isOneToOne: false
      referencedRelation: "rewatches"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"rewatches": {
                  Row: {
                    "added_by": string | null,"couple_id": string,"created_at": string,"id": string,"list_item_id": string,"watched_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by"?: string | null,"couple_id": string,"created_at"?: string,"id"?: string,"list_item_id": string,"watched_on": string
                  }
                  Update: {
                    "added_by"?: string | null,"couple_id"?: string,"created_at"?: string,"id"?: string,"list_item_id"?: string,"watched_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rewatches_added_by_fkey"
      columns: ["added_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rewatches_list_item_id_couple_id_fkey"
      columns: ["list_item_id","couple_id"]
isOneToOne: false
      referencedRelation: "list_items"
      referencedColumns: ["id","couple_id"]
    }
                  ]
                },"season_ratings": {
                  Row: {
                    "couple_id": string,"created_at": string,"list_item_id": string,"profile_id": string,"rating": number,"season": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"list_item_id": string,"profile_id": string,"rating": number,"season": number,"updated_at"?: string
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"list_item_id"?: string,"profile_id"?: string,"rating"?: number,"season"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_ratings_list_item_id_couple_id_fkey"
      columns: ["list_item_id","couple_id"]
isOneToOne: false
      referencedRelation: "list_items"
      referencedColumns: ["id","couple_id"]
    },{
      foreignKeyName: "season_ratings_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
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
                },"subtitle_files": {
                  Row: {
                    "created_at": string,"file_id": number,"language": string,"release": string,"vtt": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"file_id": number,"language": string,"release"?: string,"vtt": string
                  }
                  Update: {
                    "created_at"?: string,"file_id"?: number,"language"?: string,"release"?: string,"vtt"?: string
                  }
                  Relationships: [
                    
                  ]
                },"swipes": {
                  Row: {
                    "couple_id": string,"created_at": string,"day": string,"liked": boolean,"media_type": string,"profile_id": string,"tmdb_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"day": string,"liked": boolean,"media_type": string,"profile_id": string,"tmdb_id": number
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"day"?: string,"liked"?: boolean,"media_type"?: string,"profile_id"?: string,"tmdb_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "swipes_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swipes_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"title_texts": {
                  Row: {
                    "genres": (string)[],"locale": string,"media_type": string,"overview": string,"poster_path": string | null,"refreshed_at": string,"tagline": string,"title": string,"tmdb_id": number,"trailer_key": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "genres"?: (string)[],"locale": string,"media_type": string,"overview"?: string,"poster_path"?: string | null,"refreshed_at"?: string,"tagline"?: string,"title": string,"tmdb_id": number,"trailer_key"?: string | null
                  }
                  Update: {
                    "genres"?: (string)[],"locale"?: string,"media_type"?: string,"overview"?: string,"poster_path"?: string | null,"refreshed_at"?: string,"tagline"?: string,"title"?: string,"tmdb_id"?: number,"trailer_key"?: string | null
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
                    "backdrop_path": string | null,"episodes": number | null,"genre_ids": (number)[],"media_type": string,"original_language": string | null,"original_title": string,"poster_path": string | null,"refreshed_at": string,"release_date": string | null,"runtime": number | null,"season_episodes": (number)[] | null,"seasons": number | null,"tmdb_id": number,"vote_average": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "backdrop_path"?: string | null,"episodes"?: number | null,"genre_ids"?: (number)[],"media_type": string,"original_language"?: string | null,"original_title": string,"poster_path"?: string | null,"refreshed_at"?: string,"release_date"?: string | null,"runtime"?: number | null,"season_episodes"?: (number)[] | null,"seasons"?: number | null,"tmdb_id": number,"vote_average"?: number | null
                  }
                  Update: {
                    "backdrop_path"?: string | null,"episodes"?: number | null,"genre_ids"?: (number)[],"media_type"?: string,"original_language"?: string | null,"original_title"?: string,"poster_path"?: string | null,"refreshed_at"?: string,"release_date"?: string | null,"runtime"?: number | null,"season_episodes"?: (number)[] | null,"seasons"?: number | null,"tmdb_id"?: number,"vote_average"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"watch_nights": {
                  Row: {
                    "couple_id": string,"created_at": string,"created_by": string | null,"id": string,"link": string | null,"media_type": string | null,"method": string | null,"notes": string,"starts_at": string,"syncplay_room": string | null,"syncplay_server": string | null,"tmdb_id": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "couple_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"link"?: string | null,"media_type"?: string | null,"method"?: string | null,"notes"?: string,"starts_at": string,"syncplay_room"?: string | null,"syncplay_server"?: string | null,"tmdb_id"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "couple_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"link"?: string | null,"media_type"?: string | null,"method"?: string | null,"notes"?: string,"starts_at"?: string,"syncplay_room"?: string | null,"syncplay_server"?: string | null,"tmdb_id"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "watch_nights_couple_id_fkey"
      columns: ["couple_id"]
isOneToOne: false
      referencedRelation: "couples"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watch_nights_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "watch_nights_media_type_tmdb_id_fkey"
      columns: ["media_type","tmdb_id"]
isOneToOne: false
      referencedRelation: "titles"
      referencedColumns: ["media_type","tmdb_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "answer_night_proposal":
{ Args: { "choice": number,"proposal_id": string }; Returns: Record<string, unknown>
                           },
"create_couple":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"distinct_times":
{ Args: { "times": (string)[] }; Returns: boolean
                           },
"has_reviewed":
{ Args: { "p_list_item_id": string }; Returns: boolean
                           },
"is_my_night_room":
{ Args: { "topic": string }; Returns: boolean
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
"request_night_reminders":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"review_authors":
{ Args: { "p_list_item_ids": (string)[] }; Returns: {
              "list_item_id": string,"profile_id": string
            }[]
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
