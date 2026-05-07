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
      advisory_environment_assessments: {
        Row: {
          advisory_id: string
          affected_assets: number
          assessed_at: string | null
          assessed_by: string | null
          created_at: string
          environment_id: string
          id: string
          notes: string | null
          remediated_at: string | null
          remediation_plan: string | null
          status: Database["public"]["Enums"]["compliance_status"]
          updated_at: string
        }
        Insert: {
          advisory_id: string
          affected_assets?: number
          assessed_at?: string | null
          assessed_by?: string | null
          created_at?: string
          environment_id: string
          id?: string
          notes?: string | null
          remediated_at?: string | null
          remediation_plan?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          updated_at?: string
        }
        Update: {
          advisory_id?: string
          affected_assets?: number
          assessed_at?: string | null
          assessed_by?: string | null
          created_at?: string
          environment_id?: string
          id?: string
          notes?: string | null
          remediated_at?: string | null
          remediation_plan?: string | null
          status?: Database["public"]["Enums"]["compliance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advisory_environment_assessments_advisory_id_fkey"
            columns: ["advisory_id"]
            isOneToOne: false
            referencedRelation: "ctir_advisories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advisory_environment_assessments_environment_id_fkey"
            columns: ["environment_id"]
            isOneToOne: false
            referencedRelation: "monitored_environments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          model: string
          tokens_used: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          model?: string
          tokens_used?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          model?: string
          tokens_used?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clusters: {
        Row: {
          api_endpoint: string | null
          created_at: string
          created_by: string | null
          environment: string
          id: string
          kubernetes_version: string | null
          name: string
          node_count: number | null
          provider: Database["public"]["Enums"]["cluster_provider"]
          region: string | null
          status: Database["public"]["Enums"]["cluster_status"]
          updated_at: string
        }
        Insert: {
          api_endpoint?: string | null
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          kubernetes_version?: string | null
          name: string
          node_count?: number | null
          provider: Database["public"]["Enums"]["cluster_provider"]
          region?: string | null
          status?: Database["public"]["Enums"]["cluster_status"]
          updated_at?: string
        }
        Update: {
          api_endpoint?: string | null
          created_at?: string
          created_by?: string | null
          environment?: string
          id?: string
          kubernetes_version?: string | null
          name?: string
          node_count?: number | null
          provider?: Database["public"]["Enums"]["cluster_provider"]
          region?: string | null
          status?: Database["public"]["Enums"]["cluster_status"]
          updated_at?: string
        }
        Relationships: []
      }
      ctir_advisories: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          cves: string[] | null
          description: string | null
          id: string
          kind: Database["public"]["Enums"]["advisory_kind"]
          published_at: string | null
          recommendation: string | null
          severity: Database["public"]["Enums"]["advisory_severity"]
          source: string
          source_url: string | null
          synced_at: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          cves?: string[] | null
          description?: string | null
          id?: string
          kind: Database["public"]["Enums"]["advisory_kind"]
          published_at?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["advisory_severity"]
          source?: string
          source_url?: string | null
          synced_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          cves?: string[] | null
          description?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["advisory_kind"]
          published_at?: string | null
          recommendation?: string | null
          severity?: Database["public"]["Enums"]["advisory_severity"]
          source?: string
          source_url?: string | null
          synced_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ctir_sync_state: {
        Row: {
          created_at: string
          etag: string | null
          feed_url: string
          id: string
          items_seen: number
          last_fetched_at: string
          last_item_published_at: string | null
          last_modified: string | null
          last_status: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          etag?: string | null
          feed_url: string
          id?: string
          items_seen?: number
          last_fetched_at?: string
          last_item_published_at?: string | null
          last_modified?: string | null
          last_status?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          etag?: string | null
          feed_url?: string
          id?: string
          items_seen?: number
          last_fetched_at?: string
          last_item_published_at?: string | null
          last_modified?: string | null
          last_status?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      incidents: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          environment: string
          id: string
          mttr_minutes: number | null
          resolved_at: string | null
          service: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          source: string
          status: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string
          id?: string
          mttr_minutes?: number | null
          resolved_at?: string | null
          service?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: string
          status?: Database["public"]["Enums"]["incident_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          environment?: string
          id?: string
          mttr_minutes?: number | null
          resolved_at?: string | null
          service?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          source?: string
          status?: Database["public"]["Enums"]["incident_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitored_environments: {
        Row: {
          created_at: string
          created_by: string | null
          criticality: Database["public"]["Enums"]["environment_criticality"]
          description: string | null
          id: string
          name: string
          owner: string | null
          tags: string[] | null
          total_assets: number
          type: Database["public"]["Enums"]["environment_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criticality?: Database["public"]["Enums"]["environment_criticality"]
          description?: string | null
          id?: string
          name: string
          owner?: string | null
          tags?: string[] | null
          total_assets?: number
          type?: Database["public"]["Enums"]["environment_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criticality?: Database["public"]["Enums"]["environment_criticality"]
          description?: string | null
          id?: string
          name?: string
          owner?: string | null
          tags?: string[] | null
          total_assets?: number
          type?: Database["public"]["Enums"]["environment_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          display_name: string | null
          email: string | null
          id: string
          mfa_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          mfa_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          mfa_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      advisory_kind: "alert" | "recommendation"
      advisory_severity: "critical" | "high" | "medium" | "low"
      app_role: "admin" | "operator" | "viewer" | "auditor"
      cluster_provider:
        | "eks"
        | "gke"
        | "aks"
        | "cce"
        | "oke"
        | "openshift"
        | "openshift_local"
        | "okd"
        | "rancher"
      cluster_status:
        | "active"
        | "inactive"
        | "provisioning"
        | "error"
        | "maintenance"
      compliance_status:
        | "compliant"
        | "partial"
        | "non_compliant"
        | "not_applicable"
        | "pending"
      environment_criticality: "mission_critical" | "high" | "medium" | "low"
      environment_type:
        | "production"
        | "staging"
        | "development"
        | "dr"
        | "sandbox"
      incident_severity: "critical" | "high" | "medium" | "low"
      incident_status:
        | "open"
        | "investigating"
        | "mitigating"
        | "resolved"
        | "closed"
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
      advisory_kind: ["alert", "recommendation"],
      advisory_severity: ["critical", "high", "medium", "low"],
      app_role: ["admin", "operator", "viewer", "auditor"],
      cluster_provider: [
        "eks",
        "gke",
        "aks",
        "cce",
        "oke",
        "openshift",
        "openshift_local",
        "okd",
        "rancher",
      ],
      cluster_status: [
        "active",
        "inactive",
        "provisioning",
        "error",
        "maintenance",
      ],
      compliance_status: [
        "compliant",
        "partial",
        "non_compliant",
        "not_applicable",
        "pending",
      ],
      environment_criticality: ["mission_critical", "high", "medium", "low"],
      environment_type: [
        "production",
        "staging",
        "development",
        "dr",
        "sandbox",
      ],
      incident_severity: ["critical", "high", "medium", "low"],
      incident_status: [
        "open",
        "investigating",
        "mitigating",
        "resolved",
        "closed",
      ],
    },
  },
} as const
