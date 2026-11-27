import React from 'react';
import { X, Store } from 'lucide-react';
import type { RecipeBomItem } from '../utils/recipeBom';

interface RecipeModalProps {
  recipe: RecipeBomItem | null;
  clickedItemName?: string;
  outlets?: string[];
  qtySold?: number;
  totalMaking?: number;
  totalSale?: number;
  totalProfit?: number;
  marginPct?: number;
  onClose: () => void;
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipe,
  clickedItemName,
  outlets = [],
  qtySold = 0,
  totalMaking,
  totalSale,
  totalProfit,
  marginPct,
  onClose,
}) => {
  if (!recipe && !clickedItemName) return null;
  const effectiveQty = qtySold > 0 ? qtySold : 1;
  const displayMaking = totalMaking !== undefined ? totalMaking : recipe?.making_cost || 0;
  const displaySale = totalSale !== undefined ? totalSale : recipe?.sale_price || 0;
  const displayProfit = totalProfit !== undefined ? totalProfit : recipe?.profit || 0;
  const displayMargin = marginPct !== undefined ? marginPct : recipe?.margin_pct || 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-900 px-6 py-4 text-white flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-blue-600/30 text-blue-300 border border-blue-400/30">
                {recipe ? recipe.category : 'Recipe'}
              </span>
                {recipe && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-200">
                  {recipe.is_combo ? 'Combo Recipe' : 'Standard Recipe'}
                </span>
              )}
              {recipe && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-600/30 text-emerald-200 border border-emerald-400/30">
                  Qty: {effectiveQty.toLocaleString()} {effectiveQty === 1 ? 'unit' : 'units'}
                </span>
              )}
            </div>
            <h3 className="text-xl font-black tracking-tight mt-1.5 uppercase">
              {recipe ? recipe.name : clickedItemName}
            </h3>
            {recipe && (
              <p className="text-xs text-slate-300 mt-0.5">
                {recipe.size} &bull; {recipe.cheese}
              </p>
            )}
            {recipe && clickedItemName && recipe.name.toLowerCase() !== clickedItemName.toLowerCase() && (
              <p className="text-[11px] text-blue-300 mt-0.5">
                Matched from: <span className="font-bold text-white">{clickedItemName}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {recipe ? (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <div>
              <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2.5">
                Recipe Ingredients &amp; Cost Breakdown
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">Ingredient / Material</th>
                      <th className="py-2.5 px-4 text-center">Qty</th>
                      <th className="py-2.5 px-4 text-right">Unit Price (₹)</th>
                      <th className="py-2.5 px-4 text-right">Total Cost (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recipe.ingredients.map((ing, i) => (
                      <tr key={i} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{ing.name}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-blue-700 tabular-nums">
                          {effectiveQty.toLocaleString()}x
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-slate-700 tabular-nums font-mono">
                          ₹{ing.cost.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-bold text-slate-900 tabular-nums font-mono">
                          ₹{(ing.cost * effectiveQty).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-extrabold uppercase text-rose-600">Making</p>
                <p className="text-base font-black text-rose-700 tabular-nums mt-0.5">
                  ₹{displayMaking.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <p className="text-[10px] font-extrabold uppercase text-slate-500">Sale</p>
                <p className="text-base font-black text-slate-900 tabular-nums mt-0.5">
                  ₹{displaySale.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-extrabold uppercase text-emerald-600">Profit</p>
                <p className="text-base font-black text-emerald-700 tabular-nums mt-0.5">
                  ₹{displayProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-extrabold uppercase text-amber-700">R.M %</p>
                <p className="text-base font-black text-amber-800 tabular-nums mt-0.5">
                  {(displaySale > 0 ? (displayMaking / displaySale) * 100 : recipe.rm_pct).toFixed(1)}%
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-[10px] font-extrabold uppercase text-blue-600">Margin %</p>
                <p className="text-base font-black text-blue-700 tabular-nums mt-0.5">
                  {displayMargin.toFixed(1)}%
                </p>
              </div>
            </div>

            {outlets.length > 0 && (
              <div>
                <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-blue-600" />
                  <span>Outlets ({outlets.length})</span>
                </h4>
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {outlets.map((name, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700">
              No recipe found for &ldquo;{clickedItemName}&rdquo;.
            </p>
            <p className="text-xs text-slate-500">
              Upload your recipe costing Excel/CSV using &ldquo;Upload Excel / CSV&rdquo; above to load its ingredients.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
