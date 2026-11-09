
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_emails": {
                  Row: {
                    "added_at": string,"email": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"email": string,"user_id"?: string | null
                  }
                  Update: {
                    "added_at"?: string,"email"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ai_usage": {
                  Row: {
                    "month": string,"tribe_code": string,"uses": number
                  }
                  ComputedFields: never
                  Insert: {
                    "month": string,"tribe_code": string,"uses"?: number
                  }
                  Update: {
                    "month"?: string,"tribe_code"?: string,"uses"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_usage_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: false
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "active": boolean,"body": string | null,"created_at": string,"id": number,"link": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"body"?: string | null,"created_at"?: string,"id"?: never,"link"?: string | null,"title": string
                  }
                  Update: {
                    "active"?: boolean,"body"?: string | null,"created_at"?: string,"id"?: never,"link"?: string | null,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_versions": {
                  Row: {
                    "min_version": string,"note": string | null,"platform": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "min_version"?: string,"note"?: string | null,"platform": string,"updated_at"?: string
                  }
                  Update: {
                    "min_version"?: string,"note"?: string | null,"platform"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"calendar_feeds": {
                  Row: {
                    "created_at": string,"token": string,"tribe_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"token": string,"tribe_code": string
                  }
                  Update: {
                    "created_at"?: string,"token"?: string,"tribe_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "calendar_feeds_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: true
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"client_errors": {
                  Row: {
                    "area": string,"at": string,"id": number,"line": number | null,"message": string,"path": string | null,"source": string | null,"ua": string | null,"vid": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "area": string,"at"?: string,"id"?: never,"line"?: number | null,"message": string,"path"?: string | null,"source"?: string | null,"ua"?: string | null,"vid"?: string | null
                  }
                  Update: {
                    "area"?: string,"at"?: string,"id"?: never,"line"?: number | null,"message"?: string,"path"?: string | null,"source"?: string | null,"ua"?: string | null,"vid"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"deletion_requests": {
                  Row: {
                    "apple_revoke_error": string | null,"apple_revoked_at": string | null,"done_at": string | null,"email": string | null,"id": number,"kind": string,"requested_at": string,"tribes": (string)[],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "apple_revoke_error"?: string | null,"apple_revoked_at"?: string | null,"done_at"?: string | null,"email"?: string | null,"id"?: never,"kind"?: string,"requested_at"?: string,"tribes"?: (string)[],"user_id": string
                  }
                  Update: {
                    "apple_revoke_error"?: string | null,"apple_revoked_at"?: string | null,"done_at"?: string | null,"email"?: string | null,"id"?: never,"kind"?: string,"requested_at"?: string,"tribes"?: (string)[],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"docs": {
                  Row: {
                    "col": string,"data": NonNullable<Json>,"id": string,"tribe_code": string,"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "col": string,"data"?: NonNullable<Json>,"id": string,"tribe_code": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "col"?: string,"data"?: NonNullable<Json>,"id"?: string,"tribe_code"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "docs_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: false
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"email_log": {
                  Row: {
                    "key": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"sent_at"?: string
                  }
                  Update: {
                    "key"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"memberships": {
                  Row: {
                    "joined_at": string,"member_id": string | null,"removed_at": string | null,"role": string,"status": string,"tribe_code": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "joined_at"?: string,"member_id"?: string | null,"removed_at"?: string | null,"role"?: string,"status"?: string,"tribe_code": string,"user_id"?: string
                  }
                  Update: {
                    "joined_at"?: string,"member_id"?: string | null,"removed_at"?: string | null,"role"?: string,"status"?: string,"tribe_code"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: false
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"page_views": {
                  Row: {
                    "at": string,"campaign": string | null,"device": string,"id": number,"lang": string | null,"path": string,"src": string,"vid": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"campaign"?: string | null,"device"?: string,"id"?: never,"lang"?: string | null,"path": string,"src"?: string,"vid": string
                  }
                  Update: {
                    "at"?: string,"campaign"?: string | null,"device"?: string,"id"?: never,"lang"?: string | null,"path"?: string,"src"?: string,"vid"?: string
                  }
                  Relationships: [
                    
                  ]
                },"portfolio_goals": {
                  Row: {
                    "metric": string,"target": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "metric": string,"target": number,"updated_at"?: string
                  }
                  Update: {
                    "metric"?: string,"target"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_log": {
                  Row: {
                    "key": string,"sent_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"sent_at"?: string
                  }
                  Update: {
                    "key"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"dead": boolean,"endpoint": string,"id": number,"member_id": string | null,"p256dh": string,"prefs": NonNullable<Json>,"tribe_code": string,"tz": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"dead"?: boolean,"endpoint": string,"id"?: never,"member_id"?: string | null,"p256dh": string,"prefs"?: NonNullable<Json>,"tribe_code": string,"tz"?: string,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"dead"?: boolean,"endpoint"?: string,"id"?: never,"member_id"?: string | null,"p256dh"?: string,"prefs"?: NonNullable<Json>,"tribe_code"?: string,"tz"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: false
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"roadmap_items": {
                  Row: {
                    "area": string,"created_at": string,"details": string | null,"id": string,"priority": number,"public": boolean,"sort": number,"status": string,"target": string | null,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "area"?: string,"created_at"?: string,"details"?: string | null,"id"?: string,"priority"?: number,"public"?: boolean,"sort"?: number,"status"?: string,"target"?: string | null,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "area"?: string,"created_at"?: string,"details"?: string | null,"id"?: string,"priority"?: number,"public"?: boolean,"sort"?: number,"status"?: string,"target"?: string | null,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"saved_replies": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: never,"title": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"site_submissions": {
                  Row: {
                    "admin_note": string | null,"created_at": string,"email": string,"id": number,"kind": string,"message": string | null,"name": string | null,"phone": string | null,"status": string,"topic": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_note"?: string | null,"created_at"?: string,"email": string,"id"?: number,"kind": string,"message"?: string | null,"name"?: string | null,"phone"?: string | null,"status"?: string,"topic"?: string | null
                  }
                  Update: {
                    "admin_note"?: string | null,"created_at"?: string,"email"?: string,"id"?: number,"kind"?: string,"message"?: string | null,"name"?: string | null,"phone"?: string | null,"status"?: string,"topic"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"sitter_links": {
                  Row: {
                    "created_at": string,"expires_at": string,"token": string,"tribe_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"token": string,"tribe_code": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"token"?: string,"tribe_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sitter_links_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: false
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"subscriptions": {
                  Row: {
                    "campaign": string | null,"current_period_end": string | null,"note": string | null,"plan": string,"source": string | null,"status": string,"stripe_customer_id": string | null,"stripe_subscription_id": string | null,"trial_ends_at": string | null,"tribe_code": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "campaign"?: string | null,"current_period_end"?: string | null,"note"?: string | null,"plan"?: string,"source"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"trial_ends_at"?: string | null,"tribe_code": string,"updated_at"?: string
                  }
                  Update: {
                    "campaign"?: string | null,"current_period_end"?: string | null,"note"?: string | null,"plan"?: string,"source"?: string | null,"status"?: string,"stripe_customer_id"?: string | null,"stripe_subscription_id"?: string | null,"trial_ends_at"?: string | null,"tribe_code"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subscriptions_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: true
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"terms_acceptances": {
                  Row: {
                    "accepted_at": string,"privacy_version": string,"source": string,"terms_version": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string,"privacy_version": string,"source"?: string,"terms_version": string,"user_id"?: string
                  }
                  Update: {
                    "accepted_at"?: string,"privacy_version"?: string,"source"?: string,"terms_version"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ticket_messages": {
                  Row: {
                    "author": string,"author_email": string | null,"body": string,"created_at": string,"id": number,"internal": boolean,"ticket_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author": string,"author_email"?: string | null,"body": string,"created_at"?: string,"id"?: never,"internal"?: boolean,"ticket_id": string
                  }
                  Update: {
                    "author"?: string,"author_email"?: string | null,"body"?: string,"created_at"?: string,"id"?: never,"internal"?: boolean,"ticket_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ticket_messages_ticket_id_fkey"
      columns: ["ticket_id"]
isOneToOne: false
      referencedRelation: "tickets"
      referencedColumns: ["id"]
    }
                  ]
                },"tickets": {
                  Row: {
                    "assignee": string | null,"category": string,"context": NonNullable<Json>,"created_at": string,"customer_seen_at": string | null,"email": string,"id": string,"last_from": string,"message_count": number,"name": string | null,"number": number,"priority": string,"source": string,"status": string,"subject": string,"team_last_at": string | null,"tribe_code": string | null,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee"?: string | null,"category"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"customer_seen_at"?: string | null,"email": string,"id"?: string,"last_from"?: string,"message_count"?: number,"name"?: string | null,"number"?: never,"priority"?: string,"source"?: string,"status"?: string,"subject": string,"team_last_at"?: string | null,"tribe_code"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "assignee"?: string | null,"category"?: string,"context"?: NonNullable<Json>,"created_at"?: string,"customer_seen_at"?: string | null,"email"?: string,"id"?: string,"last_from"?: string,"message_count"?: number,"name"?: string | null,"number"?: never,"priority"?: string,"source"?: string,"status"?: string,"subject"?: string,"team_last_at"?: string | null,"tribe_code"?: string | null,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tickets_tribe_code_fkey"
      columns: ["tribe_code"]
isOneToOne: false
      referencedRelation: "tribes"
      referencedColumns: ["code"]
    }
                  ]
                },"tribes": {
                  Row: {
                    "code": string,"created_at": string,"created_by": string | null,"deleted_at": string | null,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"name": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_activation":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_daily":
{ Args: { "p_days"?: number }; Returns: {
              "day": string,"signups": number,"tribes": number
            }[]
                           },
"admin_db_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_errors":
{ Args: { "p_days"?: number }; Returns: {
              "area": string,"last_at": string,"line": number,"message": string,"n": number,"path": string,"source": string,"ua": string,"visitors": number
            }[]
                           },
"admin_set_subscription":
{ Args: { "p_code": string,"p_note"?: string,"p_status": string,"p_trial_days"?: number }; Returns: undefined
                           },
"admin_stats":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"admin_ticket_new":
{ Args: { "p_body": string,"p_category": string,"p_email": string,"p_subject": string }; Returns: Json
                           },
"admin_ticket_reply":
{ Args: { "p_body": string,"p_internal": boolean,"p_status": string,"p_ticket": string }; Returns: undefined
                           },
"admin_ticket_update":
{ Args: { "p_assignee": string,"p_category": string,"p_priority": string,"p_status": string,"p_ticket": string }; Returns: undefined
                           },
"admin_tickets":
{ Args: { "p_q"?: string,"p_status"?: string }; Returns: {
              "assignee": string,"category": string,"created_at": string,"email": string,"id": string,"last_from": string,"message_count": number,"name": string,"number": number,"preview": string,"priority": string,"source": string,"status": string,"subject": string,"tribe_code": string,"tribe_name": string,"updated_at": string
            }[]
                           },
"admin_traffic":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"admin_tribe_detail":
{ Args: { "p_code": string }; Returns: Json
                           },
"admin_tribes":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_q"?: string }; Returns: {
              "code": string,"created_at": string,"current_period_end": string,"items": number,"last_active": string,"logins": number,"name": string,"owner_email": string,"people": number,"status": string,"total": number,"trial_ends_at": string
            }[]
                           },
"admin_users":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_q"?: string }; Returns: {
              "confirmed": boolean,"created_at": string,"email": string,"id": string,"last_sign_in_at": string,"total": number,"tribes": Json
            }[]
                           },
"admin_whoami":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"ai_take_quota":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"apple_event":
{ Args: { "p_email": string,"p_secret": string,"p_sub": string,"p_type": string }; Returns: string
                           },
"apple_revoke_done":
{ Args: { "p_error": string,"p_secret": string,"p_user": string }; Returns: undefined
                           },
"apple_revoke_pending":
{ Args: { "p_secret": string }; Returns: {
              "client_id": string,"refresh_token": string,"user_id": string
            }[]
                           },
"apple_sync":
{ Args: { "p_code": string,"p_otx": string,"p_period_end": string,"p_secret": string,"p_status": string }; Returns: string
                           },
"apple_token_save":
{ Args: { "p_client"?: string,"p_token": string }; Returns: boolean
                           },
"billing_sync":
{ Args: { "p_code": string,"p_customer": string,"p_period_end": string,"p_secret": string,"p_status": string,"p_subscription": string }; Returns: boolean
                           },
"calendar_feed":
{ Args: { "p_token": string }; Returns: Json
                           },
"calendar_link":
{ Args: { "p_code": string,"p_reset": boolean }; Returns: string
                           },
"can_read":
{ Args: { "p_code": string }; Returns: boolean
                           },
"close_tribe":
{ Args: { "p_code": string }; Returns: undefined
                           },
"create_ticket":
{ Args: { "p_body": string,"p_category": string,"p_context": Json,"p_subject": string,"p_tribe": string }; Returns: Json
                           },
"create_tribe":
{ Args: { "p_name": string,"p_you": string }; Returns: Json
                           },
"doc_merge":
{ Args: { "p_code": string,"p_col": string,"p_id": string,"p_patch": Json }; Returns: undefined
                           },
"email_done":
{ Args: { "p_keys": (string)[],"p_secret": string }; Returns: undefined
                           },
"email_feed":
{ Args: { "p_secret": string }; Returns: Json
                           },
"email_stops_list":
{ Args: { "p_secret": string }; Returns: (string)[]
                           },
"ht_ai_take":
{ Args: { "p_code": string,"p_enforce": boolean }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_member":
{ Args: { "p_code": string }; Returns: boolean
                           },
"is_parent":
{ Args: { "p_code": string }; Returns: boolean
                           },
"join_tribe":
{ Args: { "p_code": string }; Returns: boolean
                           },
"jsonb_deep_merge":
{ Args: { "a": Json,"b": Json }; Returns: Json
                           },
"leave_tribe":
{ Args: { "p_code": string }; Returns: undefined
                           },
"make_sitter_link":
{ Args: { "p_code": string,"p_days": number }; Returns: Json
                           },
"manage_login":
{ Args: { "p_action": string,"p_code": string,"p_role": string,"p_user": string }; Returns: undefined
                           },
"my_deletion_pending":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"reminder_done":
{ Args: { "p_dead": (string)[],"p_keys": (string)[],"p_secret": string }; Returns: undefined
                           },
"reminder_feed":
{ Args: { "p_secret": string }; Returns: Json
                           },
"request_account_deletion":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"set_me":
{ Args: { "p_code": string,"p_member": string }; Returns: undefined
                           },
"set_signup_source":
{ Args: { "p_campaign": string,"p_code": string,"p_src": string }; Returns: undefined
                           },
"sitter_sheet":
{ Args: { "p_token": string }; Returns: Json
                           },
"stop_sitter_link":
{ Args: { "p_code": string }; Returns: undefined
                           },
"ticket_reply":
{ Args: { "p_body": string,"p_ticket": string }; Returns: undefined
                           },
"ticket_seen":
{ Args: { "p_ticket": string }; Returns: undefined
                           },
"tribe_logins":
{ Args: { "p_code": string }; Returns: {
              "email": string,"is_me": boolean,"joined_at": string,"member_id": string,"role": string,"status": string,"user_id": string
            }[]
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
  "public": {
          Enums: {
            
          }
        }
} as const
