--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_id integer,
    action_type character varying(50) NOT NULL,
    resource_type character varying(50),
    resource_name character varying(200),
    description text,
    store_id integer,
    business_type_id integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.activity_logs OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.activity_logs_id_seq OWNER TO postgres;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: business_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.business_types (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.business_types OWNER TO postgres;

--
-- Name: business_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.business_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.business_types_id_seq OWNER TO postgres;

--
-- Name: business_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.business_types_id_seq OWNED BY public.business_types.id;


--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    category character varying(100),
    store_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: companies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.companies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.companies_id_seq OWNER TO postgres;

--
-- Name: companies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.companies_id_seq OWNED BY public.companies.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    employee_id character varying(50) NOT NULL,
    full_name character varying(200) NOT NULL,
    nickname character varying(100),
    password_hash character varying(255) NOT NULL,
    store_id integer,
    role character varying(20) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT employees_role_check CHECK (((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying, 'super_admin'::character varying])::text[])))
);


ALTER TABLE public.employees OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.employees_id_seq OWNER TO postgres;

--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: monthly_sales; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_sales (
    id integer NOT NULL,
    store_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    daily_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.monthly_sales OWNER TO postgres;

--
-- Name: monthly_sales_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.monthly_sales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.monthly_sales_id_seq OWNER TO postgres;

--
-- Name: monthly_sales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.monthly_sales_id_seq OWNED BY public.monthly_sales.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    company_id integer,
    month character varying(7) NOT NULL,
    amount numeric(12,2) DEFAULT 0 NOT NULL,
    store_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.payments_id_seq OWNER TO postgres;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: pl_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.pl_data (
    id integer NOT NULL,
    store_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by integer,
    updated_by integer
);


ALTER TABLE public.pl_data OWNER TO postgres;

--
-- Name: pl_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.pl_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.pl_data_id_seq OWNER TO postgres;

--
-- Name: pl_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.pl_data_id_seq OWNED BY public.pl_data.id;


--
-- Name: sales_data; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sales_data (
    id integer NOT NULL,
    store_id integer NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    daily_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by integer,
    updated_by integer
);


ALTER TABLE public.sales_data OWNER TO postgres;

--
-- Name: sales_data_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sales_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sales_data_id_seq OWNER TO postgres;

--
-- Name: sales_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sales_data_id_seq OWNED BY public.sales_data.id;


--
-- Name: stores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stores (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    address text,
    business_type_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.stores OWNER TO postgres;

--
-- Name: stores_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stores_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.stores_id_seq OWNER TO postgres;

--
-- Name: stores_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stores_id_seq OWNED BY public.stores.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: business_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_types ALTER COLUMN id SET DEFAULT nextval('public.business_types_id_seq'::regclass);


--
-- Name: companies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies ALTER COLUMN id SET DEFAULT nextval('public.companies_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: monthly_sales id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_sales ALTER COLUMN id SET DEFAULT nextval('public.monthly_sales_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: pl_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pl_data ALTER COLUMN id SET DEFAULT nextval('public.pl_data_id_seq'::regclass);


--
-- Name: sales_data id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_data ALTER COLUMN id SET DEFAULT nextval('public.sales_data_id_seq'::regclass);


--
-- Name: stores id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores ALTER COLUMN id SET DEFAULT nextval('public.stores_id_seq'::regclass);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: business_types business_types_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_types
    ADD CONSTRAINT business_types_name_key UNIQUE (name);


--
-- Name: business_types business_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.business_types
    ADD CONSTRAINT business_types_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: employees employees_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_employee_id_key UNIQUE (employee_id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: monthly_sales monthly_sales_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_sales
    ADD CONSTRAINT monthly_sales_pkey PRIMARY KEY (id);


--
-- Name: monthly_sales monthly_sales_store_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_sales
    ADD CONSTRAINT monthly_sales_store_id_year_month_key UNIQUE (store_id, year, month);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pl_data pl_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pl_data
    ADD CONSTRAINT pl_data_pkey PRIMARY KEY (id);


--
-- Name: pl_data pl_data_store_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pl_data
    ADD CONSTRAINT pl_data_store_id_year_month_key UNIQUE (store_id, year, month);


--
-- Name: sales_data sales_data_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_pkey PRIMARY KEY (id);


--
-- Name: sales_data sales_data_store_id_year_month_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_store_id_year_month_key UNIQUE (store_id, year, month);


--
-- Name: stores stores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_pkey PRIMARY KEY (id);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: idx_employees_employee_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_employee_id ON public.employees USING btree (employee_id);


--
-- Name: idx_employees_store_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_employees_store_id ON public.employees USING btree (store_id);


--
-- Name: idx_payments_company_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_company_id ON public.payments USING btree (company_id);


--
-- Name: idx_payments_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_month ON public.payments USING btree (month);


--
-- Name: idx_pl_data_store_year_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_pl_data_store_year_month ON public.pl_data USING btree (store_id, year, month);


--
-- Name: idx_sales_data_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_data_created_at ON public.sales_data USING btree (created_at);


--
-- Name: idx_sales_data_store_year_month; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sales_data_store_year_month ON public.sales_data USING btree (store_id, year, month);


--
-- Name: idx_stores_business_type_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stores_business_type_id ON public.stores USING btree (business_type_id);


--
-- Name: activity_logs activity_logs_business_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_business_type_id_fkey FOREIGN KEY (business_type_id) REFERENCES public.business_types(id);


--
-- Name: activity_logs activity_logs_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.employees(id);


--
-- Name: companies companies_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: employees employees_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: payments payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: payments payments_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id);


--
-- Name: pl_data pl_data_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pl_data
    ADD CONSTRAINT pl_data_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: pl_data pl_data_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pl_data
    ADD CONSTRAINT pl_data_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: pl_data pl_data_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.pl_data
    ADD CONSTRAINT pl_data_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(id);


--
-- Name: sales_data sales_data_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.employees(id);


--
-- Name: sales_data sales_data_store_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_store_id_fkey FOREIGN KEY (store_id) REFERENCES public.stores(id) ON DELETE CASCADE;


--
-- Name: sales_data sales_data_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sales_data
    ADD CONSTRAINT sales_data_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.employees(id);


--
-- Name: stores stores_business_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stores
    ADD CONSTRAINT stores_business_type_id_fkey FOREIGN KEY (business_type_id) REFERENCES public.business_types(id);


--
-- PostgreSQL database dump complete
--

