-- PBR÷ROE(派生値)を追加する。PBR単体の絶対閾値は、高ROE企業ほど正当化される
-- PBR水準が高くなる(会計上はPBR=PER×ROE)ため、収益性を無視すると高品質株が
-- 軒並み「割高」と判定されてしまう問題があった(実際に候補選定を通過した17銘柄中
-- 0銘柄がPBR1.5倍以下をクリアできなかった)。ROEで正規化することで、収益性に
-- 見合ったバリュエーションかどうかを測る。forward_per(予想ベース)とroe(実績ベース)は
-- 時点がずれるため、実データではPERの単純な言い換えにはならないことを確認済み。
INSERT INTO screening_param_definitions (param_key, label, value_type, min_value, max_value, unit, description) VALUES
    ('pbr_roe_ratio', 'PBR÷ROE', 'number', 0, 200, '-', 'PBR ÷ ROE(%)。収益性(ROE)に見合ったバリュエーションかを測る指標。小さいほど収益性の割に割安。roeが0以下の銘柄はNULL(判定不能)');
