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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      avisos_enviados: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          id: string
          mensagem: string
          status: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data?: string
          id?: string
          mensagem: string
          status?: string
          user_id?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          id?: string
          mensagem?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_enviados_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_settings: {
        Row: {
          contato: string
          cor_principal: string
          cor_secundaria: string
          instagram: string
          logo_path: string | null
          nome: string
          rodape: string
          site: string
          updated_at: string
          user_id: string
          visual_personalizado: boolean
        }
        Insert: {
          contato?: string
          cor_principal?: string
          cor_secundaria?: string
          instagram?: string
          logo_path?: string | null
          nome?: string
          rodape?: string
          site?: string
          updated_at?: string
          user_id?: string
          visual_personalizado?: boolean
        }
        Update: {
          contato?: string
          cor_principal?: string
          cor_secundaria?: string
          instagram?: string
          logo_path?: string | null
          nome?: string
          rodape?: string
          site?: string
          updated_at?: string
          user_id?: string
          visual_personalizado?: boolean
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          data_vencimento: string | null
          email: string | null
          id: string
          nao_enviar_avisos: boolean
          nome: string
          observacoes: string | null
          plano: string | null
          plano_id: string | null
          status: Database["public"]["Enums"]["cliente_status"]
          updated_at: string
          user_id: string
          valor: number
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          email?: string | null
          id?: string
          nao_enviar_avisos?: boolean
          nome: string
          observacoes?: string | null
          plano?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["cliente_status"]
          updated_at?: string
          user_id?: string
          valor?: number
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          email?: string | null
          id?: string
          nao_enviar_avisos?: boolean
          nome?: string
          observacoes?: string | null
          plano?: string | null
          plano_id?: string | null
          status?: Database["public"]["Enums"]["cliente_status"]
          updated_at?: string
          user_id?: string
          valor?: number
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_config: {
        Row: {
          ativo: boolean
          avisar_no_dia: boolean
          avisar_vencidos: boolean
          dias_antes: number
          mensagem: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avisar_no_dia?: boolean
          avisar_vencidos?: boolean
          dias_antes?: number
          mensagem?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          ativo?: boolean
          avisar_no_dia?: boolean
          avisar_vencidos?: boolean
          dias_antes?: number
          mensagem?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      football_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          resultado: Json
          user_id: string
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          resultado?: Json
          user_id?: string
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          resultado?: Json
          user_id?: string
        }
        Relationships: []
      }
      football_teams: {
        Row: {
          escudo: string | null
          nome: string
          team_id: number
          user_id: string
        }
        Insert: {
          escudo?: string | null
          nome: string
          team_id: number
          user_id?: string
        }
        Update: {
          escudo?: string | null
          nome?: string
          team_id?: number
          user_id?: string
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          cliente_id: string
          created_at: string
          data_pagamento: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacao: string | null
          user_id: string
          valor: number
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_pagamento?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacao?: string | null
          user_id?: string
          valor?: number
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_pagamento?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacao?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          created_at: string
          duracao_dias: number
          id: string
          nome: string
          numero_telas: number
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          duracao_dias?: number
          id?: string
          nome: string
          numero_telas?: number
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Update: {
          created_at?: string
          duracao_dias?: number
          id?: string
          nome?: string
          numero_telas?: number
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      registrar_pagamento: {
        Args: {
          _cliente_id: string
          _data_pagamento: string
          _forma: Database["public"]["Enums"]["forma_pagamento"]
          _observacao: string
          _valor: number
        }
        Returns: string
      }
    }
    Enums: {
      cliente_status: "ativo" | "vencido" | "suspenso"
      forma_pagamento: "pix" | "dinheiro" | "cartao" | "outro"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      cliente_status: ["ativo", "vencido", "suspenso"],
      forma_pagamento: ["pix", "dinheiro", "cartao", "outro"],
    },
  },
} as const
