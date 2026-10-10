export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      appeals: {
        Row: {
          created_at: string;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          message: string;
          response: string | null;
          status: string;
          target_id: string;
          target_type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          message: string;
          response?: string | null;
          status?: string;
          target_id: string;
          target_type: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          message?: string;
          response?: string | null;
          status?: string;
          target_id?: string;
          target_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appeals_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appeals_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          id: string;
          reason: string | null;
          target_id: string;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: string;
          reason?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          id?: string;
          reason?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      auth_events: {
        Row: {
          created_at: string;
          email_hash: string | null;
          id: string;
          ip_hash: string | null;
          kind: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email_hash?: string | null;
          id?: string;
          ip_hash?: string | null;
          kind: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email_hash?: string | null;
          id?: string;
          ip_hash?: string | null;
          kind?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      blocked_domains: {
        Row: {
          added_by: string | null;
          category: string;
          created_at: string;
          domain: string;
          reason: string | null;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string | null;
          category?: string;
          created_at?: string;
          domain: string;
          reason?: string | null;
        };
        Update: {
          added_by?: string | null;
          category?: string;
          created_at?: string;
          domain?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_domains_created_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      blocked_terms: {
        Row: {
          added_by: string | null;
          category: string;
          created_at: string;
          term: string;
        };
        ComputedFields: never;
        Insert: {
          added_by?: string | null;
          category: string;
          created_at?: string;
          term: string;
        };
        Update: {
          added_by?: string | null;
          category?: string;
          created_at?: string;
          term?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocked_terms_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          moderation_state: string | null;
          resource_id: string;
          status: Database["public"]["Enums"]["comment_status"];
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
          moderation_state?: string | null;
          resource_id: string;
          status?: Database["public"]["Enums"]["comment_status"];
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          moderation_state?: string | null;
          resource_id?: string;
          status?: Database["public"]["Enums"]["comment_status"];
        };
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
        ];
      };
      follows_topics: {
        Row: {
          created_at: string;
          topic_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          topic_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          topic_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_topics_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_topics_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      follows_users: {
        Row: {
          created_at: string;
          followed_id: string;
          follower_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          followed_id: string;
          follower_id?: string;
        };
        Update: {
          created_at?: string;
          followed_id?: string;
          follower_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "follows_users_followed_id_fkey";
            columns: ["followed_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "follows_users_follower_id_fkey";
            columns: ["follower_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_events: {
        Row: {
          created_at: string;
          decision: string;
          excerpt: string | null;
          id: string;
          reasons: string[];
          target_id: string | null;
          target_type: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decision: string;
          excerpt?: string | null;
          id?: string;
          reasons: string[];
          target_id?: string | null;
          target_type: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          decision?: string;
          excerpt?: string | null;
          id?: string;
          reasons?: string[];
          target_id?: string | null;
          target_type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          kind: string;
          message: string | null;
          read_at: string | null;
          rule: string | null;
          target_id: string | null;
          target_type: string | null;
          until: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind: string;
          message?: string | null;
          read_at?: string | null;
          rule?: string | null;
          target_id?: string | null;
          target_type?: string | null;
          until?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string | null;
          read_at?: string | null;
          rule?: string | null;
          target_id?: string | null;
          target_type?: string | null;
          until?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pending_actions: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          kind: string;
          reason: string;
          requested_by: string | null;
          status: string;
          target_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          kind: string;
          reason: string;
          requested_by?: string | null;
          status?: string;
          target_id: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          kind?: string;
          reason?: string;
          requested_by?: string | null;
          status?: string;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_actions_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_actions_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          ban_reason: string | null;
          banned_until: string | null;
          bio: string | null;
          created_at: string;
          display_name: string;
          field_of_study: string | null;
          id: string;
          is_banned: boolean;
          role: Database["public"]["Enums"]["user_role"];
          trust_level: number;
          trust_level_manual: boolean;
          university: string | null;
          updated_at: string;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          ban_reason?: string | null;
          banned_until?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name: string;
          field_of_study?: string | null;
          id: string;
          is_banned?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          trust_level?: number;
          trust_level_manual?: boolean;
          university?: string | null;
          updated_at?: string;
          username: string;
        };
        Update: {
          ban_reason?: string | null;
          banned_until?: string | null;
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          field_of_study?: string | null;
          id?: string;
          is_banned?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          trust_level?: number;
          trust_level_manual?: boolean;
          university?: string | null;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      removal_requests: {
        Row: {
          created_at: string;
          details: string;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          ip_hash: string | null;
          requester_email: string;
          requester_name: string;
          resource_url: string;
          status: Database["public"]["Enums"]["report_status"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          ip_hash?: string | null;
          requester_email: string;
          requester_name: string;
          resource_url: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Update: {
          created_at?: string;
          details?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          ip_hash?: string | null;
          requester_email?: string;
          requester_name?: string;
          resource_url?: string;
          status?: Database["public"]["Enums"]["report_status"];
        };
        Relationships: [
          {
            foreignKeyName: "removal_requests_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"] | null;
          reporter_id: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_owner_id: string | null;
          target_type: Database["public"]["Enums"]["report_target"];
          weight: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          details?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"] | null;
          reporter_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_owner_id?: string | null;
          target_type: Database["public"]["Enums"]["report_target"];
          weight?: number;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"] | null;
          reporter_id?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_owner_id?: string | null;
          target_type?: Database["public"]["Enums"]["report_target"];
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "reports_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_reporter_id_fkey";
            columns: ["reporter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_target_owner_id_fkey";
            columns: ["target_owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_likes: {
        Row: {
          created_at: string;
          resource_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          resource_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          resource_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_likes_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_ratings: {
        Row: {
          counts_in_average: boolean;
          created_at: string;
          resource_id: string;
          review_text: string | null;
          stars: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          counts_in_average?: boolean;
          created_at?: string;
          resource_id: string;
          review_text?: string | null;
          stars: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          counts_in_average?: boolean;
          created_at?: string;
          resource_id?: string;
          review_text?: string | null;
          stars?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_ratings_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_ratings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resource_saves: {
        Row: {
          created_at: string;
          resource_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          resource_id: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          resource_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resource_saves_resource_id_fkey";
            columns: ["resource_id"];
            isOneToOne: false;
            referencedRelation: "resources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resource_saves_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: {
          author_id: string;
          author_review: string | null;
          comments_count: number;
          created_at: string;
          domain: string;
          final_url: string | null;
          for_whom: string;
          id: string;
          language: Database["public"]["Enums"]["resource_language"];
          last_link_check_at: string | null;
          level: Database["public"]["Enums"]["resource_level"];
          likes_count: number;
          link_check_failures: number;
          link_status: Database["public"]["Enums"]["link_status"];
          moderation_state: string | null;
          popularity_score: number;
          price: Database["public"]["Enums"]["resource_price"];
          published_at: string | null;
          rating_score: number;
          ratings_count: number;
          ratings_sum: number;
          reputation_status: string;
          saves_count: number;
          search_vector: unknown;
          slug: string;
          status: Database["public"]["Enums"]["resource_status"];
          summary: string;
          title: string;
          topic_id: string;
          type: Database["public"]["Enums"]["resource_type"];
          unvetted_domain: boolean;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string;
          author_review?: string | null;
          comments_count?: number;
          created_at?: string;
          domain?: never;
          final_url?: string | null;
          for_whom: string;
          id?: string;
          language: Database["public"]["Enums"]["resource_language"];
          last_link_check_at?: string | null;
          level: Database["public"]["Enums"]["resource_level"];
          likes_count?: number;
          link_check_failures?: number;
          link_status?: Database["public"]["Enums"]["link_status"];
          moderation_state?: string | null;
          popularity_score?: number;
          price: Database["public"]["Enums"]["resource_price"];
          published_at?: string | null;
          rating_score?: never;
          ratings_count?: number;
          ratings_sum?: number;
          reputation_status?: string;
          saves_count?: number;
          search_vector?: never;
          slug: string;
          status?: Database["public"]["Enums"]["resource_status"];
          summary: string;
          title: string;
          topic_id: string;
          type: Database["public"]["Enums"]["resource_type"];
          unvetted_domain?: boolean;
          updated_at?: string;
          url: string;
        };
        Update: {
          author_id?: string;
          author_review?: string | null;
          comments_count?: number;
          created_at?: string;
          domain?: never;
          final_url?: string | null;
          for_whom?: string;
          id?: string;
          language?: Database["public"]["Enums"]["resource_language"];
          last_link_check_at?: string | null;
          level?: Database["public"]["Enums"]["resource_level"];
          likes_count?: number;
          link_check_failures?: number;
          link_status?: Database["public"]["Enums"]["link_status"];
          moderation_state?: string | null;
          popularity_score?: number;
          price?: Database["public"]["Enums"]["resource_price"];
          published_at?: string | null;
          rating_score?: never;
          ratings_count?: number;
          ratings_sum?: number;
          reputation_status?: string;
          saves_count?: number;
          search_vector?: never;
          slug?: string;
          status?: Database["public"]["Enums"]["resource_status"];
          summary?: string;
          title?: string;
          topic_id?: string;
          type?: Database["public"]["Enums"]["resource_type"];
          unvetted_domain?: boolean;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resources_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          },
        ];
      };
      severe_incidents: {
        Row: {
          author_id: string | null;
          content_created_at: string | null;
          first_reported_at: string;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          notes: string | null;
          reports: NonNullable<Json>;
          snapshot: NonNullable<Json>;
          status: string;
          target_id: string;
          target_type: string;
        };
        ComputedFields: never;
        Insert: {
          author_id?: string | null;
          content_created_at?: string | null;
          first_reported_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          notes?: string | null;
          reports?: NonNullable<Json>;
          snapshot: NonNullable<Json>;
          status?: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          author_id?: string | null;
          content_created_at?: string | null;
          first_reported_at?: string;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          notes?: string | null;
          reports?: NonNullable<Json>;
          snapshot?: NonNullable<Json>;
          status?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "severe_incidents_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      topics: {
        Row: {
          created_at: string;
          description_uz: string | null;
          id: string;
          name_en: string | null;
          name_ru: string | null;
          name_uz: string;
          slug: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description_uz?: string | null;
          id?: string;
          name_en?: string | null;
          name_ru?: string | null;
          name_uz: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description_uz?: string | null;
          id?: string;
          name_en?: string | null;
          name_ru?: string | null;
          name_uz?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      author_records: {
        Args: { user_ids: string[] };
        Returns: {
          confirmed_reports: number;
          hidden: number;
          published: number;
          rejected: number;
          user_id: string;
        }[];
      };
      ban_details: {
        Args: { user_id: string };
        Returns: {
          ban_reason: string;
          banned_until: string;
          is_banned: boolean;
        }[];
      };
      decide_pending_action: { Args: { action_id: string; approve: boolean; note?: string }; Returns: undefined };
      delete_content: { Args: { reason: string; target_id: string; target_type: string }; Returns: undefined };
      handle_appeal: { Args: { accept: boolean; appeal_id: string; response: string }; Returns: undefined };
      handle_removal_request: {
        Args: { new_status: Database["public"]["Enums"]["report_status"]; reason: string; request_id: string };
        Returns: undefined;
      };
      handle_reports: {
        Args: {
          decision: string;
          reason: string;
          rule?: string;
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
        };
        Returns: undefined;
      };
      hit_rate_limit: {
        Args: { bucket: string; key_hash: string; max_hits: number; window_seconds: number };
        Returns: boolean;
      };
      issue_safety_ticket: {
        Args: {
          content_hash: string;
          decision: string;
          final_url?: string;
          for_user: string;
          kind: string;
          reputation?: string;
        };
        Returns: undefined;
      };
      moderate_comment: {
        Args: {
          comment_id: string;
          new_status: Database["public"]["Enums"]["comment_status"];
          reason: string;
          rule?: string;
        };
        Returns: undefined;
      };
      moderate_resource: {
        Args: {
          new_status: Database["public"]["Enums"]["resource_status"];
          reason: string;
          resource_id: string;
          rule?: string;
        };
        Returns: undefined;
      };
      my_trust_level: { Args: Record<PropertyKey, never>; Returns: number };
      record_link_check: {
        Args: { checked_url: string; outcome: string; resource_id: string };
        Returns: Database["public"]["Enums"]["link_status"];
      };
      record_reputation: { Args: { reputation: string; resource_id: string }; Returns: undefined };
      request_action: { Args: { kind: string; reason: string; target_id: string }; Returns: undefined };
      search_resources: {
        Args: {
          after_cursor?: Json;
          alt_search_text?: string;
          following_only?: boolean;
          page_size?: number;
          resource_language?: Database["public"]["Enums"]["resource_language"];
          resource_level?: Database["public"]["Enums"]["resource_level"];
          resource_price?: Database["public"]["Enums"]["resource_price"];
          resource_type?: Database["public"]["Enums"]["resource_type"];
          search_text?: string;
          sort_by?: string;
          topic_id?: string;
        };
        Returns: {
          id: string;
          next_cursor: Json;
        }[];
      };
      set_trust_level: { Args: { level: number; reason: string; user_id: string }; Returns: undefined };
      set_user_ban: { Args: { ban_days: number; reason: string; rule?: string; user_id: string }; Returns: undefined };
      set_user_role: {
        Args: { new_role: Database["public"]["Enums"]["user_role"]; reason: string; user_id: string };
        Returns: undefined;
      };
      suspicious_auth_activity: {
        Args: Record<PropertyKey, never>;
        Returns: {
          failed_sign_ins: number;
          ip_hash: string;
          last_seen: string;
          sign_ups: number;
        }[];
      };
      warn_user: { Args: { reason: string; rule?: string; user_id: string }; Returns: undefined };
      weekly_top_resources: {
        Args: { max_count?: number };
        Returns: {
          resource_id: string;
          week_likes: number;
          week_points: number;
          week_ratings: number;
          week_saves: number;
        }[];
      };
    };
    Enums: {
      comment_status: "pending" | "published" | "hidden";
      link_status: "ok" | "broken" | "unknown";
      report_reason:
        | "severe"
        | "illegal"
        | "pirated"
        | "scam_phishing"
        | "spam"
        | "harassment"
        | "wrong_info"
        | "inappropriate"
        | "copyright"
        | "other";
      report_status: "open" | "resolved" | "dismissed";
      report_target: "resource" | "comment" | "user" | "broken_link";
      resource_language: "uz" | "ru" | "en" | "other";
      resource_level: "beginner" | "intermediate" | "advanced" | "all";
      resource_price: "free" | "freemium" | "paid";
      resource_status: "pending" | "published" | "hidden" | "rejected";
      resource_type: "course" | "video" | "channel" | "book" | "website" | "tool" | "article" | "other";
      user_role: "user" | "moderator" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      comment_status: ["pending", "published", "hidden"],
      link_status: ["ok", "broken", "unknown"],
      report_reason: [
        "severe",
        "illegal",
        "pirated",
        "scam_phishing",
        "spam",
        "harassment",
        "wrong_info",
        "inappropriate",
        "copyright",
        "other",
      ],
      report_status: ["open", "resolved", "dismissed"],
      report_target: ["resource", "comment", "user", "broken_link"],
      resource_language: ["uz", "ru", "en", "other"],
      resource_level: ["beginner", "intermediate", "advanced", "all"],
      resource_price: ["free", "freemium", "paid"],
      resource_status: ["pending", "published", "hidden", "rejected"],
      resource_type: ["course", "video", "channel", "book", "website", "tool", "article", "other"],
      user_role: ["user", "moderator", "admin"],
    },
  },
} as const;
