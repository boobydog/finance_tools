-- EDINET(金融庁の開示システム)から取得する決算期別データの継続性分析機能を追加する。
-- 有価証券報告書には法定の「経営指標等の推移」(直近5期分)が含まれており、1回の取得で
-- 売上高・当期純利益等の5期分推移が手に入る。これを使って、バフェット/リンチ流の
-- 候補スクリーニングで重視される「継続性」(売上高・当期純利益の連続成長/黒字年数、CAGR)
-- を判定パラメータとして追加する。

-- 1. financial_resultsに当期純利益カラムを追加する。既存のoperating_profit(営業利益)は
--    経営指標等サマリーには5期分の推移が含まれない(個別の財務諸表本体からしか取れず、
--    かつ直近2期分のみ)ため、このパイプラインでは使用せずNULLのままにする。
ALTER TABLE financial_results ADD COLUMN net_income BIGINT COMMENT '当期純利益(百万円)' AFTER operating_profit;

-- 2. 取り込み済みのEDINET提出書類を記録する台帳テーブル。同じdoc_idの再取込を防ぎつつ、
--    訂正有価証券報告書(doc_type_code=130)は元の書類と異なるdoc_idで提出されるため、
--    「未取込の新しいdoc_id」として自然に検知できる(訂正チェックと新規取込を同じ
--    日次スキャン処理で両立できる)。
CREATE TABLE edinet_filings (
    doc_id VARCHAR(16) NOT NULL COMMENT 'EDINET書類管理番号',
    ticker_symbol VARCHAR(10) NOT NULL,
    edinet_code VARCHAR(10) NOT NULL,
    doc_type_code VARCHAR(4) NOT NULL COMMENT '120=有価証券報告書 130=訂正有価証券報告書',
    period_end DATE NULL COMMENT '当期の期末日(fiscal_period算出の基準)',
    submitted_at DATETIME NULL,
    ingested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (doc_id),
    KEY idx_edinet_filings_ticker (ticker_symbol),
    CONSTRAINT fk_edinet_filings_ticker FOREIGN KEY (ticker_symbol) REFERENCES stocks(ticker_symbol)
) COMMENT='EDINET取込済み書類の台帳(再取込防止・訂正検知用)';

-- 3. 継続性指標をstock_metricsに非正規化して保存する(financial_resultsの複数行を横断
--    集計する必要があり、他の派生値のようなSQL計算式1本では表現できないため、
--    Python側でfinancial_results取込時にまとめて計算しstock_metricsへ書き戻す)。
ALTER TABLE stock_metrics
    ADD COLUMN revenue_cagr_5y DECIMAL(10, 4) COMMENT '売上高の5期(4区間)CAGR(%)。EDINET経営指標等から算出' AFTER free_cash_flow,
    ADD COLUMN net_income_cagr_5y DECIMAL(10, 4) COMMENT '当期純利益の5期(4区間)CAGR(%)。始点・終点いずれかが赤字の場合はNULL' AFTER revenue_cagr_5y,
    ADD COLUMN consecutive_revenue_growth_years INT COMMENT '売上高が前年比で増加し続けている連続年数(0-4)' AFTER net_income_cagr_5y,
    ADD COLUMN consecutive_profit_years INT COMMENT '当期純利益が黒字であり続けている連続年数(0-5)' AFTER consecutive_revenue_growth_years;

INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('revenue_cagr_5y', '売上高5期CAGR', 'number', -100, 1000, '%', 'EDINET有価証券報告書の経営指標等(直近5期)から算出した売上高の年平均成長率'),
    ('net_income_cagr_5y', '当期純利益5期CAGR', 'number', -100, 1000, '%', 'EDINET有価証券報告書の経営指標等(直近5期)から算出した当期純利益の年平均成長率。始点・終点いずれかが赤字の場合はNULL(判定不能)'),
    ('consecutive_revenue_growth_years', '売上高成長の連続年数', 'number', 0, 4, '年', '直近から遡って売上高が前年比で増加し続けている年数'),
    ('consecutive_profit_years', '黒字の連続年数', 'number', 0, 5, '年', '直近から遡って当期純利益が黒字であり続けている年数');
