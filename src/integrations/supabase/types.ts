export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          next_action: string | null
          org_id: string
          outcome: string | null
          response_text: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          next_action?: string | null
          org_id: string
          outcome?: string | null
          response_text?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          next_action?: string | null
          org_id?: string
          outcome?: string | null
          response_text?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reads: {
        Row: {
          channel_key: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          channel_key: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          channel_key?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          assigned_to: string | null
          created_at: string
          filename: string
          id: string
          org_id: string
          row_count: number
          uploaded_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          filename: string
          id?: string
          org_id: string
          row_count?: number
          uploaded_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          filename?: string
          id?: string
          org_id?: string
          row_count?: number
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company: string | null
          created_at: string
          created_by: string | null
          custom_status: string | null
          deal_value: number | null
          description: string | null
          email: string | null
          handoff_note: string | null
          id: string
          import_batch_id: string | null
          lost_at: string | null
          name: string
          next_follow_up: string | null
          org_id: string
          phone: string | null
          source: Database["public"]["Enums"]["lead_source"]
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          won_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          custom_status?: string | null
          deal_value?: number | null
          description?: string | null
          email?: string | null
          handoff_note?: string | null
          id?: string
          import_batch_id?: string | null
          lost_at?: string | null
          name: string
          next_follow_up?: string | null
          org_id: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          won_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          custom_status?: string | null
          deal_value?: number | null
          description?: string | null
          email?: string | null
          handoff_note?: string | null
          id?: string
          import_batch_id?: string | null
          lost_at?: string | null
          name?: string
          next_follow_up?: string | null
          org_id?: string
          phone?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reasons: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
          note: string | null
          org_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
          note?: string | null
          org_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
          note?: string | null
          org_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_reasons_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_reasons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendees: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          created_at: string
          daily_room_name: string | null
          daily_room_url: string | null
          description: string | null
          end_at: string
          id: string
          lead_id: string | null
          org_id: string
          scheduled_by: string
          start_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          description?: string | null
          end_at: string
          id?: string
          lead_id?: string | null
          org_id?: string
          scheduled_by: string
          start_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          description?: string | null
          end_at?: string
          id?: string
          lead_id?: string | null
          org_id?: string
          scheduled_by?: string
          start_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_name: string | null
          attachment_type: string | null
          attachment_url: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          content: string
          created_at: string
          id: string
          image_url: string | null
          lead_id: string | null
          org_id: string
          quick_tag: string | null
          read_at: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_type: Database["public"]["Enums"]["channel_type"]
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          lead_id?: string | null
          org_id: string
          quick_tag?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_type?: string | null
          attachment_url?: string | null
          channel_type?: Database["public"]["Enums"]["channel_type"]
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          lead_id?: string | null
          org_id?: string
          quick_tag?: string | null
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          org_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          org_id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          org_id: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          org_id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_type: "call" | "email" | "whatsapp" | "meeting" | "note"
      app_role: "owner" | "rep"
      channel_type: "team" | "direct"
      lead_source:
        | "website"
        | "referral"
        | "cold_outreach"
        | "linkedin"
        | "whatsapp"
        | "other"
      lead_stage:
        | "new"
        | "contacted"
        | "interested"
        | "meeting_scheduled"
        | "proposal_sent"
        | "won"
        | "lost"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: ["call", "email", "whatsapp", "meeting", "note"],
      app_role: ["owner", "rep"],
      channel_type: ["team", "direct"],
      lead_source: [
        "website",
        "referral",
        "cold_outreach",
        "linkedin",
        "whatsapp",
        "other",
      ],
      lead_stage: [
        "new",
        "contacted",
        "interested",
        "meeting_scheduled",
        "proposal_sent",
        "won",
        "lost",
      ],
    },
  },
} as const
